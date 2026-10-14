import { test, expect } from '@playwright/test'
import { workspace } from '../live/workspace-fixture'

test('P2 preview rejects stale results and commits only after explicit confirmation', async ({ page }) => {
  let parent = ''
  let previews = 0
  let commits = 0
  const catalog = () => ({
    revision: 3 + commits,
    classification_version: 1,
    relations_version: 1,
    structure_editable: true,
    parents: parent ? { 'system/topics/child': parent } : {},
    catalog: {
      topics: ['AIGC', '文生图'].map((label, i) => ({
        id: i ? 'child' : 'parent',
        label,
        ai_label: label,
        description: label,
        active: true,
        ai_enabled: true,
        input_version: i + 1,
      })),
    },
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
    custom_tags: [],
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path.endsWith('/session')) return ok({ authenticated: true })
    if (path.endsWith('/tag-system/preview')) {
      previews++
      expect(route.request().postDataJSON().change).toMatchObject({
        kind: 'relation',
        child_ref: 'system/topics/child',
        parent_ref: 'system/topics/parent',
      })
      return ok({
        preview_token: `preview-${previews}`,
        revision: 3,
        counts: { members_before: 1, members_after: 2, member_add: 1 },
        items: [{ collection_id: 'c', article_id: 1, title: '下位匹配资料', reason: 'member_add' }],
        has_more: false,
        digest: 'all',
      })
    }
    if (path.endsWith('/tag-system/commit')) {
      commits++
      if (commits === 1) return route.fulfill({ status: 409, json: { code: 'preview_stale' } })
      expect(route.request().postDataJSON().preview_token).toBe('preview-2')
      parent = 'system/topics/parent'
      return ok({ revision: 5, reconciling: true })
    }
    return ok(
      workspace({
        catalog: catalog(),
        tag_rollups: { 'system/topics/parent': { direct: 0, total: 1, via_narrower: 1 } },
        revision: 3 + commits,
        reconciling: false,
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('tab', { name: '主题 2', exact: true }).click()
  await page.getByRole('button', { name: '编辑标签 文生图', exact: true }).click()
  await page
    .getByRole('group', { name: '上位标签（可选）', exact: true })
    .getByRole('button', { name: 'AIGC', exact: true })
    .click()
  expect(commits).toBe(0)
  await page.getByRole('button', { name: '预览全部影响', exact: true }).click()
  await expect(page.getByText('正式成员 1 → 2（不含待审核）')).toBeVisible()
  await page.getByRole('button', { name: '确认并应用', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('数据已变化')
  await expect(page.getByRole('button', { name: '确认并应用', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '预览全部影响', exact: true }).click()
  await page.getByRole('button', { name: '确认并应用', exact: true }).click()
  await expect.poll(() => parent).toBe('system/topics/parent')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.getByRole('complementary').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: '编辑标签 文生图', exact: true }).click()
  await expect(
    page
      .getByRole('group', { name: '上位标签（可选）', exact: true })
      .getByRole('button', { name: 'AIGC', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/cairn-p23-relations-mobile.png' })
})

test('expanded filter modes survive reload and old URLs remain exact', async ({ page }) => {
  const queries: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/session')) return route.fulfill({ json: { code: 'OK', data: { authenticated: true } } })
    queries.push(url.search)
    return route.fulfill({
      json: {
        code: 'OK',
        data: workspace({
          catalog: {
            revision: 1,
            relations_version: 1,
            catalog: { topics: [{ id: 'p', label: 'AIGC', active: true, ai_enabled: true }] },
            custom_tags: [],
          },
          tag_rollups: { 'system/topics/p': { direct: 0, total: 1, via_narrower: 1 } },
        }),
      },
    })
  })
  const filters = { article: { q: '', quick: 'all', fCol: null, fTags: ['AIGC'], sel: null, range: 'all' }, site: {} }
  await page.goto('/?filters=' + encodeURIComponent(JSON.stringify(filters)))
  await expect(page.getByRole('combobox', { name: /AIGC/ })).toHaveValue('exact')
  await page.getByRole('combobox', { name: /AIGC/ }).selectOption('with_narrower')
  await expect
    .poll(() => queries.some((q) => new URLSearchParams(q).get('tag_modes')?.includes('with_narrower')))
    .toBe(true)
  await page.reload()
  await expect(page.getByRole('combobox', { name: /AIGC/ })).toHaveValue('with_narrower')
})

test('P3 plan requires budget confirmation, sends stable intent, and undo is explicit', async ({ page }) => {
  let starts = 0,
    undo = 0
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { code: 'OK', data } })
    if (path.endsWith('/session')) return ok({ authenticated: true })
    if (path.endsWith('/classification/plan')) {
      expect(route.request().postDataJSON()).toMatchObject({
        scope: { dimension: 'topics', skip_rejected: false },
        include_judged: false,
        match_names: true,
      })
      return ok({
        plan_token: 'snapshot',
        article_count: 1,
        request_count: 1,
        judgment_count: 2,
        reserved_tokens: 100,
        current_valid_skipped: 3,
        ineligible_articles: 0,
        daily_request_limit: 20,
        daily_requests_remaining: 19,
        estimated_cost: null,
        model: 'fixture-only',
        items: [{ article_id: 1, title: '计划中的资料', judgments: 2 }],
        has_more: false,
      })
    }
    if (path.endsWith('/classification/runs') && route.request().method() === 'POST') {
      starts++
      expect(route.request().postDataJSON()).toMatchObject({ plan_token: 'snapshot', budget_confirmed: true })
      expect(route.request().postDataJSON().submission_key).toBeTruthy()
      return ok({ run_id: 'run-1' })
    }
    if (path.endsWith('/classification/runs'))
      return ok({
        items: starts
          ? [
              {
                run_id: 'run-1',
                status: undo ? 'revoked' : 'running',
                created_at: '2026-10-14T01:00:00Z',
                requests: 1,
                finished: 1,
              },
            ]
          : [],
        has_more: false,
      })
    if (path.endsWith('/runs/run-1/operations')) {
      expect(route.request().postDataJSON().action).toBe('undo')
      undo++
      return ok({ status: 'revoked', restored_units: 1, deleted_units_skipped: 1 })
    }
    if (path.endsWith('/runs/run-1'))
      return ok({
        status: undo ? 'revoked' : 'running',
        items: [
          {
            processing_id: 'p',
            article_id: 1,
            title: '已判断资料',
            status: 'completed',
            error_code: '',
            request_id: 'q',
            request_state: 'settled',
            outcome: 'applied',
            model: 'fixture-only',
            template: 'classification-v1',
            evaluations: [],
          },
        ],
        has_more: false,
      })
    return ok(
      workspace({
        catalog: {
          revision: 2,
          classification_version: 1,
          classification_runs: true,
          catalog: {
            topics: [{ id: 'a', label: '文生图', description: '文本生成图像', active: true, ai_enabled: true }],
          },
          custom_tags: [],
        },
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: '标签库', exact: true }).click()
  await page.getByRole('button', { name: '补标与运行记录', exact: true }).click()
  await page.getByRole('button', { name: '计算补标计划（不调用模型）', exact: true }).click()
  await expect(page.getByText(/1 篇资料 · 1 次请求 · 2 个候选判断/)).toBeVisible()
  await expect(page.getByRole('button', { name: '开始补标', exact: true })).toBeDisabled()
  expect(starts).toBe(0)
  await page.getByLabel('确认此范围、判断版本及模型调用预算；接受按配置产生费用').check()
  await page.getByRole('button', { name: '开始补标', exact: true }).click()
  await expect(page.getByText(/已判断资料/)).toBeVisible()
  await page.getByRole('button', { name: '撤销运行', exact: true }).click()
  expect(undo).toBe(0)
  await expect(page.getByText(/人工决定保留，已删除标签不会恢复/)).toBeVisible()
  await page.getByRole('button', { name: '确认并应用', exact: true }).click()
  await expect.poll(() => undo).toBe(1)
  await expect(page.getByText('已回退 1 个判断单位，跳过 1 个已删除单位。人工决定保留。')).toBeVisible()
  await page.screenshot({ path: '/tmp/cairn-p23-runs.png' })
  await page.evaluate(() => localStorage.setItem('cairn-ui:locale', 'en'))
  await page.reload()
  await page.getByRole('button', { name: 'Classification runs', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit tag 文生图', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.getByRole('complementary').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/cairn-p23-runs-en-mobile.png', fullPage: true })
})
