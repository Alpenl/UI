import { expect, test } from '@playwright/test'

test('sidebar packs tags and keeps scrollbars hidden even on hover', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.getByRole('complementary', { name: '侧边栏' })
  const topic = sidebar.getByRole('button', { name: /^主题/ })
  if ((await topic.getAttribute('aria-expanded')) === 'false') await topic.click()
  const flow = sidebar.locator('[data-compact-flow]').first()
  await expect(flow.locator('button').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  for (const width of [1440, 1100, 1440]) {
    await page.setViewportSize({ width, height: 600 })
    await sidebar.hover()
    await expect
      .poll(async () =>
        flow.evaluate((element) => {
          const pills = Array.from(element.children, (child) => child.getBoundingClientRect())
          return (
            pills.every((pill) => pill.right <= element.getBoundingClientRect().right + 1) &&
            new Set(pills.map((pill) => pill.top)).size < pills.length
          )
        }),
      )
      .toBe(true)
    const scrollers = page.locator('.scroll-quiet')
    for (const scroll of await scrollers.all()) {
      await expect(scroll).toHaveCSS('scrollbar-width', 'none')
    }
  }
  const settingsBefore = await sidebar.getByRole('button', { name: '设置', exact: true }).boundingBox()
  await sidebar.locator('.scroll-quiet').evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  expect(await sidebar.getByRole('button', { name: '设置', exact: true }).boundingBox()).toEqual(settingsBefore)
})
