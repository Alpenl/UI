import { article, workspace } from './workspace-fixture'
import { test, expect, type Page } from '@playwright/test'
async function backend(page: Page, conflict = false) {
  const writes: Record<string, unknown>[] = []
  let collection: Record<string, unknown> | undefined
  await page.route(/^http:\/\/127\.0\.0\.1:5198\/api\//, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      writes.push(body)
      if (conflict) return route.fulfill({ status: 409, json: { error: 'revision_conflict' } })
      const id = path.split('/')[3]
      collection = {
        id,
        name: body.name,
        description: body.description,
        revision: 1,
        pinned: 0,
        archived: 0,
        deleted: 0,
        rule_tags: '[]',
        rule_mode: 'any',
      }
      return route.fulfill({ json: { revision: 1 } })
    }
    const json =
      path === '/api/workspace'
        ? workspace({ collections: collection ? [collection] : [] })
        : path === '/api/workspace/1'
          ? {
              article: { ...article, body: ['真实正文'], raw: '真实正文' },
              tag_state: { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] },
            }
          : { counts: { pending: 2, processing: 1, failed: 0, exhausted: 0, completed: 4 } }
    await route.fulfill({ json })
  })
  return writes
}
test('production content, real status, language and refresh without browser persistence', async ({ page }) => {
  await backend(page)
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('已连接生产后端')
  await page
    .getByRole('button', { name: /生产测试内容/ })
    .first()
    .click()
  await expect(page.getByText('真实正文', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('浏览器无需填写访问令牌', { exact: false })).toBeVisible()
  await expect(page.getByText('demo_access_token')).toHaveCount(0)
  await page.getByLabel('界面语言', { exact: true }).selectOption('en')
  await expect(page.getByText('Connection credentials stay', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Topics 0', exact: true })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'cairn-ui:locale'))).toEqual([])
})
for (const conflict of [false, true])
  test(`collection create ${conflict ? 'conflict recovery' : 'persists through server'}`, async ({ page }) => {
    const writes = await backend(page, conflict)
    await page.goto('/')
    await expect(page.getByRole('status')).toContainText('已连接生产后端')
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByRole('tab', { name: '合集管理', exact: true }).click()
    await page.getByRole('button', { name: '新建合集', exact: true }).last().click()
    await page.getByPlaceholder('合集名称', { exact: true }).fill('共享合集')
    await page.getByRole('button', { name: '创建', exact: true }).click()
    if (conflict) {
      await expect(page.getByRole('alert')).toContainText('内容已在其他页面更新')
      await page.getByRole('button', { name: '放弃草稿并刷新', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('已连接生产后端')
    } else {
      await expect(page.getByRole('status')).toContainText('已连接生产后端')
      await page.reload()
      await expect(page.getByText('共享合集', { exact: true }).first()).toBeVisible()
    }
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ expected_revision: 0, type: 'create', name: '共享合集' })
    expect(writes[0].operation_key).toMatch(/^[a-f0-9-]{36}$/)
  })
test('backend errors never fall back to demonstration content', async ({ page }) => {
  await page.route(/^http:\/\/127\.0\.0\.1:5198\/api\//, (route) => route.fulfill({ status: 503, json: {} }))
  await page.goto('/')
  await expect(page.getByRole('alert').first()).toContainText('读取生产数据失败')
  await expect(page.getByText('LoRA 再探', { exact: false })).toHaveCount(0)
})
test('renders the first page independently of library size and cancels stale searches', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  const reads: string[] = []
  await page.route('**/api/workspace*', async (route) => {
    const u = new URL(route.request().url())
    reads.push(u.searchParams.get('q') ?? '')
    if (u.searchParams.get('q') === 'slow') await new Promise((resolve) => setTimeout(resolve, 700))
    const q = u.searchParams.get('q') ?? ''
    await route
      .fulfill({
        json: workspace({
          total: q ? 1 : 10000,
          next_cursor: q ? null : 1,
          facets: { total: 10000, failed: 0, tags: {} },
          items: [{ ...article, title: q || 'First summary' }],
        }),
      })
      .catch(() => {})
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('已连接生产后端')
  await expect(page.getByRole('button', { name: '文章 10000', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
  expect(reads).toHaveLength(1)
  const search = page.getByPlaceholder('搜索标题、摘要、正文、链接')
  await search.fill('slow')
  await expect.poll(() => reads.includes('slow')).toBe(true)
  await search.fill('fast')
  await expect(page.getByRole('heading', { name: 'fast', exact: true })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole('heading', { name: 'fast', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'slow', exact: true })).toHaveCount(0)
})

test('a failed filter leaves loading state and retries the same query without showing stale results', async ({
  page,
}) => {
  let fail = true
  const reads: string[] = []
  await page.route('**/api/workspace*', async (route) => {
    const quick = new URL(route.request().url()).searchParams.get('quick') ?? 'all'
    reads.push(quick)
    if (quick === 'todo' && fail) return route.fulfill({ status: 503, json: {} })
    return route.fulfill({
      json: workspace({ items: quick === 'todo' ? [] : [article], facets: { total: 1, failed: 1, tags: {} } }),
    })
  })
  await page.goto('/')
  await expect(page.getByText(article.title, { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: /待处理/ })
    .first()
    .click()
  await expect(page.getByRole('alert').first()).toContainText('读取生产数据失败')
  await expect(page.getByText('正在加载内容…', { exact: true })).toHaveCount(0)
  await expect(page.getByText(article.title, { exact: true })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: '重试', exact: true }).first().click()
  await expect(page.getByText('没有匹配的资料', { exact: true })).toBeVisible()
  expect(reads.filter((q) => q === 'todo')).toHaveLength(2)
})
