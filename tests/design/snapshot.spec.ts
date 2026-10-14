import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Article } from '../../src/domain/library'
const snapshot = JSON.parse(readFileSync(new URL('../../src/design/snapshot.json', import.meta.url), 'utf8')) as {
  workspace: { items: Article[] }
  details: Record<string, { article: Article }>
}

test('real snapshot, pagination, search, reader and no API access', async ({ page }) => {
  const network: string[] = [],
    errors: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/') || new URL(r.url()).origin !== 'http://127.0.0.1:5197')
      network.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: `已收录 ${snapshot.workspace.items.length} 篇文章` })).toBeVisible()
  await expect(page.getByText(/真实数据快照/)).toBeVisible()
  await expect(page.getByText('标签判定完成', { exact: true }).first()).toBeVisible()
  const article = snapshot.workspace.items[0]
  await page
    .getByRole('button', { name: new RegExp(article.title) })
    .first()
    .click()
  await expect(page.getByRole('button', { name: '原文快照', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '原文快照', exact: true })).toBeVisible()
  await page.getByPlaceholder('搜索标题、摘要、正文、链接').fill('ComfyUI')
  await expect(page.getByRole('heading', { name: '搜索结果', exact: true })).toBeVisible()
  expect(network).toEqual([])
  expect(errors).toEqual([])
})

test('current tag design, local settings and bilingual interface', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('本地快照，无需后端')).toBeVisible()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await expect(page.getByRole('button', { name: '新增标签', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /编辑标签/ }).first()).toBeVisible()
  await page
    .getByRole('button', { name: /编辑标签/ })
    .first()
    .click()
  await expect(page.getByText(/上位标签/, { exact: false }).first()).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: '状态与账户', exact: true }).click()
  await page.getByLabel('界面语言', { exact: true }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText(/Real-data snapshot/)).toBeVisible()
})

test('local archived image and adaptive video load without credentials', async ({ page }) => {
  const entries = Object.values(snapshot.details) as { article: Article }[]
  const video = entries.find((d) =>
    d.article.media?.some((m) => m.status === 'ready' && m.content_type === 'video/mp4'),
  )!
  const filters = encodeURIComponent(JSON.stringify({ article: { sel: video.article.id }, site: {} }))
  await page.goto('/?filters=' + filters)
  const player = page.locator('video').first()
  await player.scrollIntoViewIfNeeded()
  await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1)
  expect(await player.getAttribute('src')).toMatch(/^\/design-media\//)
  await player.evaluate((v: HTMLVideoElement) => {
    v.muted = true
    return v.play()
  })
  await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0)
  const imageArticle = entries.find((d) => d.article.images?.length)!
  await page.goto(
    '/?filters=' + encodeURIComponent(JSON.stringify({ article: { sel: imageArticle.article.id }, site: {} })),
  )
  const img = page.locator('img[src^="/design-media/"]').first()
  await img.scrollIntoViewIfNeeded()
  await expect.poll(() => img.evaluate((v: HTMLImageElement) => v.naturalWidth)).toBeGreaterThan(0)
})

test('mobile navigation and hidden scrollbars retain stable layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '打开导航', exact: true }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('tab', { name: '标签库', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(
    await page
      .locator('.scroll-quiet')
      .first()
      .evaluate((el) => getComputedStyle(el).scrollbarWidth),
  ).toBe('none')
})

test('trash preview rejects deletion and preserves snapshot after reload', async ({ page }) => {
  const network: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/') || new URL(r.url()).origin !== 'http://127.0.0.1:5197')
      network.push(r.url())
  })
  await page.goto('/')
  const article = snapshot.workspace.items[0]
  await page
    .getByRole('button', { name: new RegExp(article.title) })
    .first()
    .click()
  await page.getByRole('button', { name: '移入回收站', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /保存、删除、预览计算和模型调用不执行/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '原文快照', exact: true })).toBeVisible()
  await page
    .getByRole('complementary')
    .getByRole('button', { name: /^回收站/ })
    .click()
  await expect(page.getByText('快照未包含回收站记录')).toBeVisible()
  await page.reload()
  await expect(page.getByText('快照未包含回收站记录')).toBeVisible()
  await page.getByRole('button', { name: '返回收藏' }).click()
  await expect(page.getByRole('heading', { name: `已收录 ${snapshot.workspace.items.length} 篇文章` })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cairn-ui:design:v1:trash'))).toBeNull()
  expect(network).toEqual([])
})
