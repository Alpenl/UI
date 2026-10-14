import { test, expect } from '@playwright/test'
import { article, workspace } from './workspace-fixture'
const state = { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] }
const detail = {
  article: { ...article, body: Array.from({ length: 60 }, () => '正文内容，用于验证刷新保留阅读位置。') },
  tag_state: state,
}

test('fresh navigation reuses queries and details, while refresh retains mounted content', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/workspace**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.pathname + url.search)
    await new Promise((done) => setTimeout(done, 350))
    await route.fulfill({ json: url.pathname === '/api/workspace' ? workspace() : detail })
  })
  await page.goto('/')
  const list = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2 }) })
    .first()
  const row = list.getByRole('heading', { name: article.title, exact: true })
  await expect(row).toBeVisible()
  expect(requests).toHaveLength(1)
  await list.getByRole('button', { name: '近七天', exact: true }).click()
  await expect(row).toBeVisible()
  expect(requests).toHaveLength(2)
  await list.getByRole('button', { name: '全部', exact: true }).click()
  await expect(row).toBeVisible()
  await list.getByRole('button', { name: '近七天', exact: true }).click()
  await expect(row).toBeVisible()
  expect(requests).toHaveLength(2)
  await row.hover()
  await expect.poll(() => requests.length).toBe(3)
  await row.click()
  const reader = page.getByTestId('reader-scroll')
  await expect(reader).toBeVisible()
  expect(requests).toHaveLength(3)
  await page.keyboard.press('Escape')
  await expect(reader).toHaveCount(0)
  await row.click()
  await expect(reader).toBeVisible()
  expect(requests).toHaveLength(3)
  await reader.evaluate((el) => {
    el.scrollTop = 350
    el.setAttribute('data-retained', 'yes')
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByText('正在更新…', { exact: true })).toBeVisible()
  await expect(row).toBeVisible()
  await expect(reader).toHaveAttribute('data-retained', 'yes')
  await expect(page.getByText('已连接生产后端', { exact: true })).toBeVisible()
  await expect(reader).toHaveAttribute('data-retained', 'yes')
  expect(await reader.evaluate((el) => el.scrollTop)).toBe(350)
  expect(requests).toHaveLength(5)
  await page.reload()
  await expect(reader).toBeVisible()
  expect(requests).toHaveLength(7) // A hard reload never replays persisted article data.
})

test('article deep links fetch summaries and detail concurrently', async ({ page }) => {
  const paths: string[] = []
  let release!: () => void
  const gate = new Promise<void>((done) => {
    release = done
  })
  await page.route('**/api/workspace**', async (route) => {
    const path = new URL(route.request().url()).pathname
    paths.push(path)
    await gate
    await route.fulfill({ json: path === '/api/workspace' ? workspace() : detail })
  })
  const filters = { article: { q: '', quick: 'all', fTags: [], fCol: null, sel: 1, range: 'all' }, site: {} }
  await page.goto('/?filters=' + encodeURIComponent(JSON.stringify(filters)))
  await expect.poll(() => paths.sort()).toEqual(['/api/workspace', '/api/workspace/1'])
  expect(await page.getByTestId('reader-scroll').count()).toBe(0)
  release()
  await expect(page.getByTestId('reader-scroll')).toBeVisible()
  expect(paths).toHaveLength(2)
})

test('transient detail failures preserve reading, but revoked access cannot keep showing it', async ({ page }) => {
  let status = 200
  await page.route('**/api/workspace**', (route) => {
    const isDetail = new URL(route.request().url()).pathname !== '/api/workspace'
    return route.fulfill({
      status: isDetail ? status : 200,
      json: isDetail ? (status === 200 ? detail : { error: 'unavailable' }) : workspace(),
    })
  })
  await page.goto('/')
  await page.getByRole('heading', { level: 3 }).click()
  const reader = page.getByTestId('reader-scroll')
  await expect(reader).toBeVisible()
  status = 500
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '更新失败' })).toBeVisible()
  await expect(reader).toBeVisible()
  status = 404
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(reader).toHaveCount(0)
  await expect(page.getByText('读取生产数据失败，请检查连接后重试。', { exact: true })).toBeVisible()
})
