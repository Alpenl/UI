import { test, expect } from '@playwright/test'
import { workspace } from '../live/workspace-fixture'

test('tag cloud deletion unlocks after its receipt even while summary refresh is pending', async ({ page }) => {
  const labels = new Map([
    ['a', '串推'],
    ['b', '教程'],
    ['c', '保留'],
  ])
  let revision = 4,
    hold = false
  let release!: () => void
  const slow = new Promise<void>((resolve) => {
    release = resolve
  })
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path === '/api/v1/session') return ok({ authenticated: true })
    if (path === '/api/v1/tag-catalog/operations') {
      const body = req.postDataJSON()
      writes.push(body)
      expect(body.expected_revision).toBe(revision)
      expect(body.type).toBe('delete')
      labels.delete(body.id)
      revision++
      hold = true
      return ok({
        revision,
        deletion: {
          tag_refs: ['system/topics/' + body.id],
          catalog_revision: revision,
          article_revisions: {},
          collection_revisions: {},
        },
      })
    }
    if (hold) await slow
    return ok(
      workspace({
        catalog: {
          revision,
          catalog: {
            topics: [...labels].map(([id, label]) => ({
              id,
              label,
              description: label,
              active: true,
              ai_enabled: true,
            })),
          },
        },
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  const edit = page.getByRole('button', { name: '编辑标签 串推', exact: true })
  const remove = page.getByRole('button', { name: '删除标签 串推', exact: true })
  await expect(edit).toHaveAttribute('aria-expanded', 'false')
  await edit.click()
  await expect(remove).toBeVisible()
  await remove.click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect(writes).toHaveLength(0)
  await remove.click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(remove).toHaveCount(0)
  const second = page.getByRole('button', { name: '删除标签 教程', exact: true })
  await page.getByRole('button', { name: '编辑标签 教程', exact: true }).click()
  await expect(second).toBeEnabled()
  await second.click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(second).toHaveCount(0)
  expect(writes).toHaveLength(2)
  release()
  await expect(page.getByRole('status')).toContainText('已连接生产后端')
  await expect(page.getByRole('button', { name: '编辑标签 保留', exact: true })).toBeVisible()
})

for (const archived of [0, 1])
  test(`deleting a custom type (archived=${archived}) sends one confirmed command and retains built-in types`, async ({
    page,
  }) => {
    let deleted = false
    const dim = {
      id: 'difficulty',
      label: '难度',
      description: '定义',
      color: 2,
      ai_enabled: 1,
      archived,
      revision: 3,
    }
    const tag = {
      id: '11111111-1111-4111-8111-111111111111',
      tag_ref: 'custom/default/11111111-1111-4111-8111-111111111111',
      label: '入门',
      dimension_id: dim.id,
      status: 'active',
      revision: 2,
      description: '定义',
      ai_enabled: true,
    }
    const writes: Record<string, unknown>[] = []
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
      if (path === '/api/v1/session') return ok({ authenticated: true })
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        writes.push(body)
        expect(body).toMatchObject({ type: 'dimension_delete', id: dim.id, expected_revision: 3, detach_all: true })
        deleted = true
        return ok({
          revision: 4,
          deletion: {
            dimension_id: dim.id,
            tag_refs: [tag.tag_ref],
            catalog_revision: 6,
            article_revisions: {},
            collection_revisions: {},
          },
        })
      }
      return ok(
        workspace({
          catalog: {
            revision: deleted ? 6 : 5,
            catalog: {},
            dimensions: deleted ? [] : [dim],
            custom_tags: deleted ? [] : [tag],
          },
        }),
      )
    })
    await page.goto('/')
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByRole('tab', { name: '标签库', exact: true }).click()
    await expect(page.getByRole('button', { name: '删除类型', exact: true })).toBeDisabled()
    if (archived) {
      await page.getByRole('button', { name: '已停用的类型', exact: true }).click()
      await page.getByRole('button', { name: '删除类型 难度', exact: true }).click()
    } else {
      await page.getByRole('tab', { name: /难度/ }).click()
      await page.getByRole('button', { name: '删除类型', exact: true }).click()
    }
    await expect(page.getByText(/删除此类型及其 1 个标签/)).toBeVisible()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await expect(page.getByRole('tab', { name: /难度/ })).toHaveCount(0)
    expect(writes).toHaveLength(1)
    await page.reload()
    await expect(page.getByRole('button', { name: '编辑标签 入门', exact: true })).toHaveCount(0)
  })

test('a rejected deletion does not lock the page; deleting the last tag retains its built-in type', async ({
  page,
}) => {
  let attempts = 0,
    deleted = false
  const keys: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path === '/api/v1/session') return ok({ authenticated: true })
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      keys.push(body.operation_key)
      expect(body).toMatchObject({ type: 'delete', id: 'a', dimension: 'uses', expected_revision: 4 })
      if (++attempts === 1) return route.fulfill({ status: 409, json: { code: 'last_ai_tag' } })
      deleted = true
      return ok({
        deletion: { tag_refs: ['system/use/a'], catalog_revision: 5, article_revisions: {}, collection_revisions: {} },
      })
    }
    return ok(
      workspace({
        catalog: {
          revision: deleted ? 5 : 4,
          catalog: {
            uses: deleted ? [] : [{ id: 'a', label: '背景', description: '背景知识', active: true, ai_enabled: true }],
          },
        },
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('tab', { name: /用途/ }).click()
  await expect(
    page.getByText('内置类型保留，不能删除；其中的标签可全部删除。没有自动标签时，AI 会跳过此类型。'),
  ).toBeVisible()
  await page.getByRole('button', { name: '编辑标签 背景', exact: true }).click()
  await page.getByRole('button', { name: '删除标签 背景', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('操作未执行，数据未更改。')
  await expect(page.getByRole('button', { name: '保存 / 重试', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '新增标签', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('button', { name: '删除标签 背景', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page.getByRole('button', { name: '删除标签 背景', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '用途 0', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '删除类型', exact: true })).toBeDisabled()
  expect(keys[0]).not.toBe(keys[1])
  await page.reload()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('tab', { name: '用途 0', exact: true }).click()
  await expect(page.getByRole('button', { name: '删除标签 背景', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '新增标签', exact: true })).toBeEnabled()
})
