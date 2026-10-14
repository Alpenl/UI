import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { article, workspace } from './workspace-fixture'

async function openVideo(page: Page, shape: string) {
  const data = await readFile(new URL(`../fixtures/media/${shape}.webm`, import.meta.url))
  await page.route('**/api/workspace**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === '/api/workspace'
          ? workspace()
          : {
              article: {
                ...article,
                body: ['视频尺寸与播放验证'],
                media: [
                  {
                    id: 'b'.repeat(32),
                    title: '测试视频',
                    kind: 'video',
                    content_type: 'video/webm',
                    size: data.length,
                    status: 'ready',
                  },
                ],
              },
              tag_state: { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] },
            },
    }),
  )
  await page.route('**/api/media/**', async (route) => {
    const start = Number(
      route
        .request()
        .headers()
        .range?.match(/bytes=(\d+)-/)?.[1] ?? 0,
    )
    await route.fulfill({
      status: 206,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${data.length - 1}/${data.length}` },
      contentType: 'video/webm',
      body: data.subarray(start),
    })
  })
  await page.goto('/?filters=' + encodeURIComponent(JSON.stringify({ article: { sel: 1 }, site: {} })))
  const player = page.locator('media-controller')
  await expect(page.locator('video')).toHaveJSProperty(
    'videoWidth',
    shape === 'portrait' ? 180 : shape === 'square' ? 240 : 320,
  )
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute('data-ready', 'true')
  return player
}

for (const [shape, ratio] of [
  ['landscape', 16 / 9],
  ['portrait', 9 / 16],
  ['square', 1],
] as const) {
  test(`${shape} video keeps its intrinsic ratio without clipping the picture or controls`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const player = await openVideo(page, shape)
    expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    await expect(page.getByRole('link', { name: '下载文件' })).toHaveCount(0)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      const collapse = page.getByRole('button', { name: '收起', exact: true })
      if (width === 390 && (await collapse.isVisible())) await collapse.click()
      await player.scrollIntoViewIfNeeded()
      const bounds = (await player.boundingBox())!
      const video = (await page.locator('video').boundingBox())!
      expect(Math.abs(bounds.width / bounds.height - ratio)).toBeLessThan(0.01)
      expect(Math.abs(video.width / video.height - ratio)).toBeLessThan(0.01)
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      for (const control of await player.locator('media-control-bar > [role="button"]').all()) {
        if (!(await control.isVisible())) continue
        const button = (await control.boundingBox())!
        expect(button.x).toBeGreaterThanOrEqual(bounds.x)
        expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        expect(button.y + button.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
      }
      await player.screenshot({ path: info.outputPath(`${shape}-${width}.png`) })
    }
  })
}

test('video overlays support playback, seeking, speed, fullscreen and keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const player = await openVideo(page, 'portrait')
  const play = player.locator('media-control-bar media-play-button')
  await play.click()
  await expect(page.locator('video')).toHaveJSProperty('paused', false)
  await page.mouse.move(1, 1)
  await expect(player.locator('.cairn-player-controls')).toHaveCSS('opacity', '0')
  await player.hover()
  await expect(player.locator('.cairn-player-controls')).toHaveCSS('opacity', '1')
  await play.click()
  await expect(page.locator('video')).toHaveJSProperty('paused', true)
  const slider = player.getByRole('slider', { name: '跳转' })
  const beforeSeek = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(beforeSeek)
  const track = (await slider.boundingBox())!
  await slider.click({ position: { x: track.width * 0.75, y: track.height / 2 } })
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(5)
  await player.locator('media-playback-rate-menu-button').click()
  await player.getByRole('menuitemradio', { name: '1.5x', exact: true }).click()
  await expect(page.locator('video')).toHaveJSProperty('playbackRate', 1.5)
  await expect(player.locator('media-playback-rate-menu-button')).toBeFocused()
  await player.locator('media-fullscreen-button').click()
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
  await expect(page.locator('video')).toHaveCSS('object-fit', 'contain')
  await page.evaluate(() => document.exitFullscreen())
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
})

test.describe('touch playback', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('portrait video can be played and paused on a phone', async ({ page }) => {
    const player = await openVideo(page, 'portrait')
    await player.locator('.cairn-player-start').tap()
    await expect(page.locator('video')).toHaveJSProperty('paused', false)
    await player.locator('media-control-bar media-play-button').tap()
    await expect(page.locator('video')).toHaveJSProperty('paused', true)
    await expect(player.locator('.cairn-player-controls')).toHaveCSS('opacity', '1')
  })
})
