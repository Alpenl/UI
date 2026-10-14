import { workspace } from './workspace-fixture'
import { test, expect, type Page } from '@playwright/test'
type Dimension = {
  id: string
  label: string
  description: string
  color: number
  ai_enabled: number
  archived: number
  revision: number
}
type Tag = {
  id: string
  label: string
  tag_ref: string
  status: string
  revision: number
  dimension_id: string | null
  description: string
  aliases: string[]
  ai_enabled: boolean
}
async function managementBackend(page: Page, beforeWrite?: () => Promise<void>) {
  const dimensions: Dimension[] = [],
    tags: Tag[] = [],
    writes: Record<string, unknown>[] = []
  await page.route(/^http:\/\/127\.0\.0\.1:5198\/api\//, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    if (req.method() !== 'GET') {
      const b = req.postDataJSON()
      writes.push(b)
      await beforeWrite?.()
      if (path === '/api/tag-catalog/operations') {
        const old = dimensions.find((d) => d.id === b.id)
        if (b.expected_revision !== (old?.revision ?? 0))
          return route.fulfill({ status: 409, json: { error: 'revision_conflict' } })
        const d = old ?? { id: b.id, label: '', description: '', color: 0, ai_enabled: 1, archived: 0, revision: 0 }
        if (!old) dimensions.push(d)
        Object.assign(d, b.definition)
        d.ai_enabled = Number(!!d.ai_enabled)
        d.revision++
        if (b.type === 'dimension_archive') d.archived = 1
        if (b.type === 'dimension_restore') d.archived = 0
        return route.fulfill({ json: { revision: d.revision, dimension: d } })
      }
      if (path.startsWith('/api/custom-tags')) {
        const old = tags.find((t) => t.id === path.split('/')[3])
        if (old && old.revision !== b.expected_revision)
          return route.fulfill({ status: 409, json: { error: 'revision_conflict' } })
        const id = old?.id ?? '11111111-1111-4111-8111-111111111111'
        const tag = old ?? {
          id,
          label: '',
          tag_ref: `custom/default/${id}`,
          status: 'active',
          revision: 0,
          dimension_id: null,
          description: '',
          aliases: [],
          ai_enabled: false,
        }
        if (!old) tags.push(tag)
        Object.assign(tag, {
          label: b.label,
          description: b.description,
          aliases: b.aliases,
          ai_enabled: b.ai_enabled,
          dimension_id: b.dimension_id,
          status: b.archived ? 'deprecated' : 'active',
          revision: tag.revision + 1,
        })
        return route.fulfill({ json: { tag } })
      }
      return route.fulfill({ status: 400, json: { error: 'unexpected_write' } })
    }
    return route.fulfill({
      json: workspace({
        total: 0,
        items: [],
        catalog: { revision: 0, catalog: {}, custom_tags: tags, dimensions },
        facets: { total: 0, failed: 0, tags: {} },
      }),
    })
  })
  return { dimensions, tags, writes }
}
const saved = (page: Page) => expect(page.getByRole('status')).toContainText('已连接生产后端')
test('custom type and tag survive create, edit, manual switch, archive and restore', async ({ page }) => {
  const db = await managementBackend(page)
  await page.goto('/')
  await saved(page)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('button', { name: '新增标签类型', exact: true }).click()
  await page.getByLabel('新类型名称', { exact: true }).fill('难度')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await saved(page)
  expect(db.dimensions[0]).toMatchObject({ label: '难度', ai_enabled: 1 })
  await page.getByRole('button', { name: '新增标签', exact: true }).click()
  const nameInput = page.getByRole('textbox').first()
  await nameInput.fill('入门')
  await nameInput.press('Enter')
  await page.getByRole('textbox').last().fill('不需要预备知识，包含基础概念和逐步操作。')
  const ai = page.getByRole('switch', { name: 'AI 自动打标', exact: true }).last()
  if ((await ai.getAttribute('aria-checked')) === 'false') await ai.click()
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await saved(page)
  expect(db.tags[0]).toMatchObject({ label: '入门', dimension_id: db.dimensions[0].id, ai_enabled: true })
  const identity = db.tags[0].tag_ref
  await page.getByRole('button', { name: '编辑标签 入门', exact: true }).click()
  await page.getByRole('textbox').first().fill('初学者')
  await page.getByRole('textbox').first().press('Enter')
  await page.getByRole('switch', { name: 'AI 自动打标', exact: true }).last().click()
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await saved(page)
  expect(db.tags[0]).toMatchObject({ label: '初学者', tag_ref: identity, ai_enabled: false })
  await page.getByRole('button', { name: '停用类型', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await saved(page)
  expect(db.dimensions[0].archived).toBe(1)
  await page.getByRole('button', { name: '已停用的类型', exact: true }).click()
  await page.getByRole('button', { name: '恢复 难度', exact: true }).click()
  await saved(page)
  await page.reload()
  await saved(page)
  await page.getByRole('tab', { name: /难度/ }).click()
  await expect(page.getByText('初学者', { exact: true })).toBeVisible()
  expect(db.dimensions[0].archived).toBe(0)
})

test('collection state tabs have exactly one visual and accessible selection', async ({ page }) => {
  await managementBackend(page)
  await page.goto('/')
  await saved(page)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '合集管理', exact: true }).click()
  for (const name of ['已归档', '已删除', '进行中', '已删除', '已归档']) {
    const tab = page.getByRole('tab', { name, exact: true })
    await tab.click()
    const group = tab.locator('..')
    await expect(group.locator('[aria-selected="true"]')).toHaveCount(1)
    await expect(group.locator('.bg-g-text')).toHaveCount(1)
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(tab).toHaveClass(/bg-g-text/)
  }
})

test('an unfinished edit is not saving, and slow writes leave navigation usable', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((done) => {
    release = done
  })
  const db = await managementBackend(page, () => gate)
  db.tags.push({
    id: '11111111-1111-4111-8111-111111111111',
    label: '测试标签',
    tag_ref: 'custom/default/11111111-1111-4111-8111-111111111111',
    status: 'active',
    revision: 1,
    dimension_id: null,
    description: '',
    aliases: [],
    ai_enabled: false,
  })
  await page.goto('/')
  await saved(page)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('tab', { name: /自定义/ }).click()
  await page.getByRole('button', { name: '编辑标签 测试标签', exact: true }).click()
  const name = page.getByRole('textbox').first()
  await name.fill('更名标签')
  await name.press('Enter')
  await expect(page.getByRole('status')).toContainText('有未保存的修改')
  expect(db.writes).toHaveLength(0)
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('正在保存更改')
  await expect(page.getByRole('button', { name: '编辑标签 更名标签', exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: '合集管理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '文章合集', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^文章 \d+$/ }).click()
  await expect(page.getByRole('heading', { name: '全部文章', exact: true })).toBeVisible()
  release()
  await saved(page)
  expect(db.writes).toHaveLength(1)
  expect(db.tags[0].label).toBe('更名标签')
})

test('deletes an inactive built-in tag once and keeps the page usable while it saves', async ({ page }) => {
  let deleted = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/tag-catalog/operations', async (route) => {
    writes.push(route.request().postDataJSON())
    await pending
    deleted = true
    await route.fulfill({ json: { revision: 4, operation_revision: 4 } })
  })
  await page.route('**/api/workspace**', (route) =>
    route.fulfill({
      json: workspace({
        catalog: {
          revision: deleted ? 4 : 3,
          catalog: {
            topics: [
              { id: 'active', label: '保留主题', active: true, description: '定义', ai_enabled: true },
              ...(!deleted ? [{ id: 'archived', label: '停用主题', active: false, description: '定义' }] : []),
            ],
          },
        },
      }),
    }),
  )
  await page.goto('/')
  await saved(page)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('button', { name: '编辑标签 停用主题', exact: true }).click()
  await page.getByRole('button', { name: '删除标签 停用主题', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({ expected_revision: 3, type: 'delete', dimension: 'topics', id: 'archived' })
  await page.getByRole('tab', { name: '合集管理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '文章合集', exact: true })).toBeVisible()
  release()
  await saved(page)
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await expect(page.getByRole('button', { name: '编辑标签 停用主题', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '编辑标签 保留主题', exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
})
