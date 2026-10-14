import { test, expect } from '@playwright/test'
import { article, workspace } from './workspace-fixture'

const image = '/api/images/' + encodeURIComponent('enrichment/1/' + 'a'.repeat(64) + '.png')
const state = { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] }
test('reading panes scroll independently, settings stay at the bottom, and archived media renders safely', async ({
  page,
}) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('tracker.invalid')) external.push(request.url())
  })
  await page.route('**/api/workspace**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === '/api/workspace'
          ? workspace({
              items: Array.from({ length: 40 }, (_, i) => ({ ...article, id: i + 1, title: `测试 ${i + 1}` })),
            })
          : {
              article: {
                ...article,
                body: [
                  '## 正文标题\n\n![归档图片](cairn-image:0)\n\n![外链](https://tracker.invalid/image.png)\n\n<script>alert(1)</script>\n\n[危险链接](javascript:alert(1))',
                  ...Array.from({ length: 60 }, () => '阅读段落，验证独立滚动。'),
                ],
                images: [{ src: image }],
                media: [
                  {
                    id: 'b'.repeat(32),
                    title: '归档视频',
                    kind: 'video',
                    content_type: 'video/mp4',
                    size: 100,
                    status: 'ready',
                  },
                  {
                    id: 'c'.repeat(32),
                    title: '归档音频',
                    kind: 'audio',
                    content_type: 'audio/mpeg',
                    size: 100,
                    status: 'ready',
                  },
                  {
                    id: 'd'.repeat(32),
                    title: '等待视频',
                    kind: 'video',
                    content_type: null,
                    size: 0,
                    status: 'declared',
                  },
                ],
              },
              tag_state: state,
            },
    }),
  )
  await page.route('**/api/images/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
  const mediaRequests: string[] = []
  await page.route('**/api/media/**', (route) => {
    mediaRequests.push(route.request().url())
    return route.fulfill({ status: 404 })
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: /测试 1$/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: '正文标题' })).toBeVisible()
  await expect(page.getByRole('img', { name: '归档图片', exact: true })).toBeVisible()
  expect(
    await page
      .getByRole('img', { name: '归档图片', exact: true })
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1)
  await page.getByRole('button', { name: '放大图片：归档图片' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '原始尺寸', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '正文标题' })).toBeVisible()
  await expect(page.getByRole('button', { name: '放大图片：归档图片' })).toBeFocused()
  await expect(page.locator('.reader-content script')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '危险链接' })).not.toHaveAttribute('href', /javascript:/)
  expect(external).toEqual([])
  expect(mediaRequests).toEqual([])
  for (const height of [700, 540, 1000]) {
    await page.setViewportSize({ width: 1440, height })
    const settings = page.getByRole('button', { name: '设置', exact: true })
    const before = await settings.boundingBox()
    expect(before!.y + before!.height).toBeGreaterThan(height - 30)
    const reader = page.getByTestId('reader-scroll')
    await reader.hover()
    await page.mouse.wheel(0, 3000)
    await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    expect(await settings.boundingBox()).toEqual(before)
    expect(await page.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight }))).toEqual({
      y: 0,
      height,
    })
  }
  await page.getByTestId('reader-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect(page.locator('video')).toHaveAttribute('preload', 'metadata')
  await expect(page.locator('audio')).toHaveAttribute('preload', 'none')
  await expect(page.getByText('等待视频 · 尚未完成归档')).toBeVisible()
  await expect(page.getByText('无法播放，可重试或下载查看。')).toBeVisible()
  expect(mediaRequests).toHaveLength(1)
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect.poll(() => mediaRequests.length).toBe(2)
  await expect(page.getByText('无法播放，可重试或下载查看。')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('reader-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const video = await page.locator('video').boundingBox()
  expect(video!.width).toBeGreaterThan(200)
  expect(video!.x + video!.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.evaluate(() => localStorage.setItem('cairn-ui:locale', 'en'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enlarge image: 归档图片' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'play', exact: true }).first()).toBeAttached()
})

test('filtered deep links never flash unfiltered or demo content, and refresh clears stale results', async ({
  page,
}) => {
  const requests: URL[] = []
  let empty = false
  await page.addInitScript(() => {
    localStorage.setItem('cairn-ui:arts-v3', JSON.stringify([{ title: '残留演示' }]))
    ;(window as unknown as { flashes: string[] }).flashes = []
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('未筛选内容') || document.body?.textContent?.includes('残留演示'))
        (window as unknown as { flashes: string[] }).flashes.push(document.body.textContent)
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await page.route('**/api/workspace**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    await new Promise((done) => setTimeout(done, 200))
    const filtered = url.searchParams.get('tags')?.includes('system/topics/ai')
    await route.fulfill({
      json: workspace({
        catalog: { revision: 1, catalog: { topics: [{ id: 'ai', label: '人工智能' }] } },
        total: empty || !filtered ? 0 : 1,
        items: empty
          ? []
          : filtered
            ? [{ ...article, title: '筛选内容' }]
            : url.searchParams.get('tags') === '[]'
              ? [{ ...article, title: '未筛选内容' }]
              : [],
      }),
    })
  })
  const filters = {
    article: { q: '', quick: 'all', fCol: null, fTags: ['人工智能'], sel: null, range: 'all' },
    site: {},
  }
  await page.goto('/?filters=' + encodeURIComponent(JSON.stringify(filters)))
  await expect(page.getByRole('heading', { name: '筛选内容', exact: true })).toBeVisible()
  expect(requests.every((u) => u.searchParams.get('tags') !== '[]')).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { flashes: string[] }).flashes)).toEqual([])
  empty = true
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByRole('heading', { name: '筛选内容', exact: true })).toHaveCount(0)
  await expect(page.getByText('没有匹配的资料')).toBeVisible()
  await page.reload()
  await expect(page.getByText('没有匹配的资料')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { flashes: string[] }).flashes)).toEqual([])
})
