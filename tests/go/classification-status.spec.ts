import { expect, test } from '@playwright/test'
import { article, workspace } from '../live/workspace-fixture'

test('classification state stays separate from reading and preserves readable summaries', async ({ page }) => {
  let state = 'not_started'
  const writes: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') writes.push(request.method())
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (new URL(request.url()).pathname === '/api/v1/session') return ok({ authenticated: true })
    return ok(
      workspace({
        items: [
          { ...article, summary: '可读摘要保持显示', failed: true, sourceAvailable: true, classificationStatus: state },
        ],
      }),
    )
  })
  await page.goto('/')
  await expect(page.getByText('尚未打标', { exact: true })).toBeVisible()
  await expect(page.getByText('可读摘要保持显示', { exact: true })).toBeVisible()
  for (const [value, label] of [
    ['queued', '标签排队中'],
    ['legacy_unconfirmed', '旧打标请求待核对，未自动重试'],
    ['completed', '标签判定完成'],
  ]) {
    state = value
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  expect(writes).toEqual([])
})
