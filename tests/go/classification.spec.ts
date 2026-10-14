import { test, expect } from '@playwright/test'
import { workspace } from '../live/workspace-fixture'

test('P1 rename preserves AI basis; receipt unlocks before refresh; semantic edits need a choice', async ({ page }) => {
  let revision = 4
  let hold = false
  let release!: () => void
  const slow = new Promise<void>((resolve) => {
    release = resolve
  })
  const tags = [
    {
      id: 'a',
      label: '文生图',
      ai_label: 'Text-to-Image',
      description: '文本生成图像',
      aliases: [] as string[],
      active: true,
      ai_enabled: true,
      input_version: 1,
      review: { unknown: 2, needs_review: 0 },
    },
    {
      id: 'b',
      label: '保留',
      ai_label: '保留',
      description: '其他定义',
      aliases: [] as string[],
      active: true,
      ai_enabled: true,
      input_version: 2,
      review: { unknown: 0, needs_review: 0 },
    },
  ]
  const catalog = () => ({
    classification_version: 1,
    revision,
    catalog: { topics: tags },
    custom_tags: [],
    dimensions: [
      {
        id: 'topics',
        label: '主题',
        ai_label: '主题',
        description: '领域',
        color: 0,
        ai_enabled: 1,
        archived: 0,
        revision: 1,
      },
    ],
  })
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (new URL(req.url()).pathname === '/api/v1/session') return ok({ authenticated: true })
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      writes.push(body)
      expect(body.expected_revision).toBe(revision)
      expect(body.type).toBe('edit')
      expect(body.definition.ai_label).toBe('Text-to-Image')
      if (writes.length === 1) {
        expect(body.definition.label).toBe('T2I')
        expect(body.definition.aliases).toContain('文生图')
        expect(body.definition.change_class).toBeUndefined()
      } else {
        expect(body.definition.change_class).toBe('narrower')
        tags[0].input_version = 3
        tags[0].review.needs_review = 1
      }
      Object.assign(tags[0], body.definition)
      revision++
      hold = true
      return ok({ revision, operation_revision: revision, id: 'a', catalog: catalog() })
    }
    if (hold) await slow
    return ok(workspace({ catalog: catalog() }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('tab', { name: '主题 2', exact: true }).click()
  await page.getByRole('button', { name: '编辑标签 文生图', exact: true }).click()
  await page.getByLabel('名称（改名会同步更新所有关联）').fill('T2I')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('button', { name: '编辑标签 T2I', exact: true })).toBeEnabled()
  await expect.poll(() => writes.length).toBe(1)
  await page.getByRole('button', { name: '编辑标签 T2I', exact: true }).click()
  await page.getByText('AI 判断依据', { exact: true }).click()
  await expect(page.getByLabel('AI 使用的名称')).toHaveValue('Text-to-Image')
  await expect(page.getByText(/历史版本未知：2 项/)).toBeVisible()
  await page.getByRole('textbox', { name: '分类定义', exact: true }).fill('仅讨论提示词驱动的图像生成')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('请选择分类含义变化类别')
  expect(writes).toHaveLength(1)
  await page.getByRole('button', { name: '编辑标签 T2I', exact: true }).click()
  await page.getByText('AI 判断依据', { exact: true }).click()
  await page.getByRole('combobox', { name: '分类含义如何变化', exact: true }).selectOption('narrower')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  await expect(page.getByRole('button', { name: '编辑标签 保留', exact: true })).toBeEnabled()
  release()
  await page.getByRole('button', { name: '编辑标签 T2I', exact: true }).click()
  await expect(page.getByText(/需要复查：1 项/)).toBeVisible()
  await page.screenshot({ path: '/tmp/cairn-p1-zh.png' })
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await page.getByRole('tab', { name: '状态与账户', exact: true }).click()
  await page.locator('#interface-language').selectOption('en')
  await page.getByRole('tab', { name: 'Tag library', exact: true }).click()
  await page.getByRole('tab', { name: /^(Topic|主题).*2$/ }).click()
  await page.getByRole('button', { name: 'Edit tag T2I', exact: true }).click()
  await page.getByText('AI classification basis', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name used by AI', exact: true })).toHaveValue('Text-to-Image')
  await page.screenshot({ path: '/tmp/cairn-p1-en.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.getByRole('complementary').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1)
  await page.screenshot({ path: '/tmp/cairn-p1-mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('old Go contracts do not advertise or submit unsupported classification fields', async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        code: 'OK',
        data: new URL(route.request().url()).pathname === '/api/v1/session' ? { authenticated: true } : workspace(),
      },
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await expect(page.getByRole('button', { name: '类型的 AI 判断依据' })).toHaveCount(0)
})
