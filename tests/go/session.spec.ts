import { test, expect } from '@playwright/test'
import { article, workspace } from '../live/workspace-fixture'

test('private data waits for login; CSRF protects writes and logout clears the library', async ({ page }) => {
  let signedIn = false
  let libraryReads = 0
  let writeVerified = false
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path === '/api/v1/session') {
      if (req.method() === 'POST') {
        expect(req.postDataJSON()).toEqual({ password: 'test-password' })
        signedIn = true
        await page.context().addCookies([{ name: 'cairn_csrf', value: 'test-csrf', url: 'http://127.0.0.1:5199' }])
      }
      if (req.method() === 'DELETE') {
        expect(req.headers()['x-csrf-token']).toBe('test-csrf')
        signedIn = false
      }
      return ok({ authenticated: signedIn })
    }
    expect(signedIn).toBe(true)
    if (req.method() !== 'GET') {
      expect(req.headers()['x-csrf-token']).toBe('test-csrf')
      expect(req.headers().authorization).toBeUndefined()
      expect(req.postDataJSON().operation_key).toBeTruthy()
      writeVerified = true
      return ok({ revision: 1, operation_revision: 1 })
    }
    if (path === '/api/v1/overview')
      return ok({ counts: { pending: 0, processing: 0, completed: 1, failed: 0, exhausted: 0 } })
    libraryReads++
    return ok(workspace())
  })
  await page.goto('/')
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  expect(libraryReads).toBe(0)
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText(article.title, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '合集管理', exact: true }).click()
  await page.getByRole('button', { name: '新建合集', exact: true }).last().click()
  await page.getByPlaceholder('合集名称', { exact: true }).fill('新 Go 合集')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect.poll(() => writeVerified).toBe(true)
  await page.getByRole('tab', { name: '状态与账户', exact: true }).click()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  await expect(page.getByText(article.title, { exact: true })).toHaveCount(0)
})

test('failed AI processing retains the archived source and uses versioned Go media URLs', async ({ page }) => {
  const imageID = 'a'.repeat(32)
  const data = {
    ...article,
    failed: true,
    sourceAvailable: true,
    body: ['已保存的原文。', '![归档](cairn-image:0)'],
    raw: '原文快照',
    images: [{ src: `/api/media/${imageID}` }],
  }
  let mediaRequested = false
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path === '/api/v1/session') return ok({ authenticated: true })
    if (path === `/api/v1/media/${imageID}`) {
      mediaRequested = true
      return route.fulfill({ status: 404 })
    }
    if (path === '/api/v1/workspace/1')
      return ok({
        article: data,
        body_unchanged: false,
        tag_state: { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] },
      })
    return ok(workspace({ items: [data] }))
  })
  await page.goto(
    '/?filters=' +
      encodeURIComponent(
        JSON.stringify({ article: { q: '', quick: 'all', fTags: [], fCol: null, sel: 1, range: 'all' }, site: {} }),
      ),
  )
  await expect(page.getByText('已保存的原文。', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '原文快照', exact: true })).toBeVisible()
  await expect.poll(() => mediaRequested).toBe(true)
})
