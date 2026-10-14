import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

// Run the pinned reference independently. Never generate reference baselines from the implementation.
const reference = process.env.REFERENCE_URL
const application = process.env.APP_URL
if (!reference || !application) throw new Error('Set REFERENCE_URL and APP_URL to the two running applications')
const output = 'test-results/design'
await mkdir(output, { recursive: true })
const scenarios = [
  { name: 'overview', open: async () => {} },
  {
    name: 'reader',
    open: async (page) => {
      await page
        .getByRole('button', { name: /LoRA 再探/ })
        .first()
        .click()
      await page.getByRole('heading', { level: 1, name: /LoRA 再探/ }).waitFor()
    },
  },
  {
    name: 'sites',
    open: async (page) => {
      await page.getByRole('button', { name: '网站 6', exact: true }).click()
    },
  },
  {
    name: 'site-details',
    open: async (page) => {
      await page.getByRole('button', { name: '网站 6', exact: true }).click()
      await page.getByRole('button', { name: 'Mobbin，查看详情', exact: true }).click()
    },
  },
  {
    name: 'collections',
    open: async (page) => {
      await page.getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole('tab', { name: '合集管理', exact: true }).click()
    },
  },
  {
    name: 'tags',
    open: async (page) => {
      await page.getByRole('button', { name: '设置', exact: true }).click()
      await page.getByRole('tab', { name: '标签库', exact: true }).click()
    },
  },
  { name: 'mobile-library', viewport: { width: 390, height: 844 }, open: async () => {} },
]
const browser = await chromium.launch()
const report = []
try {
  for (const scenario of scenarios) {
    const captures = []
    for (const [label, url] of [
      ['reference', reference],
      ['application', application],
    ]) {
      const page = await browser.newPage({
        viewport: scenario.viewport ?? { width: 1440, height: 1000 },
        locale: 'zh-CN',
      })
      await page.goto(url)
      await page.getByRole('heading', { name: '全部文章', exact: true }).waitFor()
      await scenario.open(page)
      await page.evaluate(() => document.fonts.ready)
      await page.mouse.move(0, 0)
      await page.waitForTimeout(600)
      const buffer = await page.screenshot({ path: `${output}/${scenario.name}-${label}.png`, animations: 'disabled' })
      captures.push(PNG.sync.read(buffer))
      await page.close()
    }
    const [a, b] = captures
    const diff = new PNG({ width: a.width, height: a.height })
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
    const ratio = changed / (a.width * a.height)
    await writeFile(`${output}/${scenario.name}-diff.png`, PNG.sync.write(diff))
    report.push({ page: scenario.name, changedPixels: changed, ratio })
    console.log(`${scenario.name}: ${(ratio * 100).toFixed(4)}% changed pixels`)
  }
} finally {
  await browser.close()
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
if (report.some((result) => result.ratio > 0.001)) process.exitCode = 1
