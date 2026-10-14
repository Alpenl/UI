import { afterEach, expect, it, vi } from 'vitest'
import {
  BackendError,
  applyDeletion,
  clearOperationJournal,
  loadSnapshot,
  operationKey,
  saveChanges,
  type Snapshot,
} from '@/api/production'
const id = '3b7b4c4c-7f7a-4d3c-8db6-f91c13b8b0d6'
const article = {
  id: 2,
  kind: 'article' as const,
  title: 'Article',
  source: 'example.com',
  url: 'https://example.com',
  date: '2026-10-12',
  lang: 'en' as const,
  summary: '',
  body: [],
  raw: '',
  tags: [],
  excluded: [],
  cols: {},
  links: [],
}
const initial = (): Snapshot => ({
  arts: [article],
  cols: [],
  tags: [
    {
      name: 'Topic',
      dim: 'topics',
      auto: true,
      enabled: true,
      aliases: '',
      desc: 'A topic',
      field: 'topics',
      term: 'topic',
      ref: 'system/topics/topic',
    },
  ],
  tagStates: { 2: { revision: 7, content_revision: 3, decision_id: 9, selection: {}, custom_tags: [] } },
  collectionRevisions: {},
  catalogRevision: 4,
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearOperationJournal()
})
it('generates protocol-compatible unique UUIDs on plain HTTP', () => {
  expect(operationKey()).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  expect(operationKey()).not.toEqual(operationKey())
})
it('loads one bounded summary page and server totals without fetching every article', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      version: 1,
      total: 10000,
      next_cursor: 2,
      facets: { total: 10000, failed: 0, tags: { 'system/topics/topic': 1000 } },
      overview: { saved: 10000, tags: 1000, placed: 0, latest_id: 2, days: [], events: [], failed: [] },
      catalog: { revision: 1, catalog: { topics: [{ id: 'topic', label: 'Topic' }] } },
      collections: [],
      items: [{ ...article, tags: ['system/topics/topic'] }],
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  const snapshot = await loadSnapshot({ q: 'query', cursor: 3 })
  expect(snapshot.arts).toHaveLength(1)
  expect(snapshot.arts[0].tags).toEqual(['Topic'])
  expect(snapshot.arts[0].body).toEqual([])
  expect(snapshot.server?.total).toBe(10000)
  expect(snapshot.server?.next_cursor).toBe(2)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/workspace?q=query&cursor=3')
})
it('uses the loaded tag revision and does not overwrite a concurrent edit', async () => {
  const before = initial(),
    after = structuredClone(before)
  after.arts[0].tags = ['Topic']
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'revision_conflict' }, { status: 409 }))
  vi.stubGlobal('fetch', fetcher)
  await expect(saveChanges(before, after)).rejects.toBeInstanceOf(BackendError)
  const sent = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(sent).toMatchObject({
    expected_revision: 7,
    expected_content_revision: 3,
    expected_decision_id: 9,
    actions: [{ action: 'accept', tag_ref: 'system/topics/topic' }],
  })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('keeps identical tag labels and term IDs in different dimensions independent', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(
    Response.json({
      version: 1,
      total: 1,
      next_cursor: null,
      facets: { total: 1, failed: 0, tags: {} },
      overview: { saved: 1, tags: 2, placed: 0, latest_id: 2, days: [], events: [], failed: [] },
      catalog: {
        revision: 1,
        catalog: {
          resource_kinds: [{ id: 'method', label: '方法' }],
          content_functions: [{ id: 'method', label: '方法' }],
        },
      },
      collections: [],
      items: [{ ...article, tags: ['system/resource_kinds/method', 'system/content_functions/method'] }],
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  const before = await loadSnapshot()
  expect(new Set(before.arts[0].tags).size).toBe(2)
  expect(new Set(before.tags.map((t) => t.name)).size).toBe(2)
  const after = structuredClone(before)
  after.tags[1].desc = 'Updated definition'
  fetcher.mockResolvedValue(Response.json({ revision: 2, id: 'method' }))
  await saveChanges(before, after)
  const sent = JSON.parse(fetcher.mock.calls[1][1].body)
  expect(sent).toMatchObject({
    type: 'edit',
    dimension: 'content_functions',
    id: 'method',
    definition: { label: '方法', description: 'Updated definition' },
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('chains collection revisions when creating, adding membership and saving a note', async () => {
  const before = initial(),
    after = structuredClone(before)
  after.cols.push({
    id,
    kind: 'article',
    name: 'Collection',
    purpose: '',
    pinned: false,
    archived: false,
    rule: [],
    mode: 'any',
  })
  after.arts[0].cols[id] = 'note'
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return Response.json({ revision: bodies.length })
    }),
  )
  await saveChanges(before, after)
  expect(bodies.map((x) => [x.type, x.expected_revision])).toEqual([
    ['create', 0],
    ['add', 1],
    ['note', 2],
  ])
  expect(new Set(bodies.map((x) => x.operation_key)).size).toBe(3)
})
it('rejects unsupported mixed edits before writing anything', async () => {
  const before = initial(),
    after = structuredClone(before)
  after.arts[0].kind = 'site'
  after.arts[0].tags = ['Topic']
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await expect(saveChanges(before, after)).rejects.toThrow('unsupported')
  expect(fetcher).not.toHaveBeenCalled()
})
it('renames by stable identity without detaching article tags or changing collection rules', async () => {
  const before = initial(),
    after = structuredClone(before)
  before.arts[0].tags = ['Topic']
  after.arts[0].tags = ['Renamed']
  after.tags[0].name = 'Renamed'
  const fetcher = vi.fn().mockResolvedValue(Response.json({ revision: 5, id: 'topic' }))
  vi.stubGlobal('fetch', fetcher)
  await saveChanges(before, after)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    type: 'edit',
    id: 'topic',
    definition: { label: 'Renamed' },
  })
})
it('saves definition edits and status changes as separate revision-checked operations', async () => {
  const before = initial(),
    after = structuredClone(before)
  before.tags.push({ ...before.tags[0], name: 'Second', term: 'second', ref: 'system/topics/second' })
  after.tags.push({ ...before.tags[1] })
  after.tags[0].desc = 'Updated'
  after.tags[0].enabled = false
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init) => {
      bodies.push(JSON.parse(init.body))
      return Response.json({ revision: 4 + bodies.length, id: 'topic' })
    }),
  )
  await saveChanges(before, after)
  expect(bodies.map((b) => [b.type, b.expected_revision])).toEqual([
    ['edit', 4],
    ['archive', 5],
  ])
})
it('keeps disabled rule definitions, exclusions and review settings while renaming a collection', async () => {
  const before = initial()
  before.cols = [
    {
      id,
      kind: 'article',
      name: 'Old',
      purpose: '',
      rule: ['Topic'],
      mode: 'any',
      ruleEnabled: false,
      exclude: [],
      admission: 'review',
      confirmedOnly: true,
      pinned: false,
      archived: false,
    },
  ]
  before.collectionRevisions[id] = 8
  const after = structuredClone(before)
  after.cols[0].name = 'New'
  const fetcher = vi.fn().mockResolvedValue(Response.json({ revision: 9 }))
  vi.stubGlobal('fetch', fetcher)
  await saveChanges(before, after)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetcher.mock.calls[0][1].body).type).toBe('edit')
})
it('retries a partially committed batch with the same operation identities', async () => {
  const before = initial(),
    after = structuredClone(before)
  after.cols = [
    { id, kind: 'article', name: 'New', purpose: '', rule: [], mode: 'any', pinned: false, archived: false },
  ]
  after.arts[0].cols[id] = ''
  const bodies: Record<string, unknown>[] = []
  let fail = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init) => {
      const b = JSON.parse(init.body)
      bodies.push(b)
      if (b.type === 'add' && fail) {
        fail = false
        throw new Error('lost response')
      }
      return Response.json({ revision: b.type === 'create' ? 1 : 2 })
    }),
  )
  await expect(saveChanges(before, after)).rejects.toThrow('lost response')
  await saveChanges(before, after)
  expect(bodies[0].operation_key).toBe(bodies[2].operation_key)
  expect(bodies[1].operation_key).toBe(bodies[3].operation_key)
})
it.each(['custom', 'topics'])('preserves a new %s tag’s disabled state when archive needs a retry', async (dim) => {
  const before = initial(),
    after = structuredClone(before)
  after.tags.push({
    name: 'Disabled',
    dim,
    auto: false,
    enabled: false,
    aliases: '',
    desc: 'Definition',
    ref: `draft/${id}`,
    field: dim,
    term: id,
  })
  const writes: { path: string; body: Record<string, unknown> }[] = []
  let fail = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      writes.push({ path, body })
      if ((body.archived || body.type === 'archive') && fail) {
        fail = false
        throw new Error('lost archive response')
      }
      return Response.json(
        dim === 'custom' ? { tag: { tag_ref: `custom/default/${id}`, revision: 1 } } : { id, revision: 5 },
      )
    }),
  )
  await expect(saveChanges(before, after)).rejects.toThrow('lost archive response')
  await saveChanges(before, after)
  expect(writes).toHaveLength(4)
  expect(writes[0]).toEqual(writes[2])
  expect(writes[1]).toEqual(writes[3])
  expect(writes[1].body).toMatchObject(
    dim === 'custom'
      ? { archived: true, expected_revision: 1 }
      : { type: 'archive', expected_revision: 5, dimension: 'topics', id },
  )
})
it('validates cached body revisions when fetching and uses new body revisions', async () => {
  const { loadArticle } = await import('@/api/production')
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        article: { ...article, id: 991, bodyRevision: 4, raw: 'Old source', body: ['Old source'] },
        tag_state: initial().tagStates[2],
        body_unchanged: false,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        article: { ...article, id: 991, bodyRevision: 4 },
        tag_state: { ...initial().tagStates[2], revision: 8 },
        body_unchanged: true,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        article: { ...article, id: 991, bodyRevision: 5, raw: 'New source', body: ['New source'] },
        tag_state: initial().tagStates[2],
        body_unchanged: false,
      }),
    )
  vi.stubGlobal('fetch', fetcher)
  await loadArticle(991, [])
  const cached = await loadArticle(991, [])
  expect(cached.article.raw).toBe('Old source')
  expect(cached.state.revision).toBe(8)
  expect(fetcher.mock.calls[1][0]).toBe('/api/workspace/991?body_revision=4')
  expect((await loadArticle(991, [])).article.raw).toBe('New source')
})

it('applies deletion identities without erasing content or unrelated rules and invalidates affected tag states', () => {
  const before = initial()
  before.parents = { 'system/topics/topic': 'parent', child: 'system/topics/topic', keep: 'other' }
  before.arts[0] = { ...before.arts[0], body: ['original'], tags: ['Topic'], personalRevision: 7 }
  before.cols = [
    {
      id,
      kind: 'article',
      name: 'Rules',
      purpose: '',
      pinned: false,
      archived: false,
      rule: ['Topic'],
      exclude: ['Topic'],
      ruleEnabled: true,
      ruleTagModes: { 'system/topics/topic': 'with_narrower' },
      ruleExcludeModes: { 'system/topics/topic': 'exact' },
      mode: 'any',
    },
  ]
  const after = applyDeletion(before, {
    tag_refs: ['system/topics/topic'],
    catalog_revision: 5,
    article_revisions: { 2: 8 },
    collection_revisions: { [id]: 9 },
  })
  expect(after.tags).toHaveLength(0)
  expect(after.arts[0]).toMatchObject({ body: ['original'], tags: [], personalRevision: 8 })
  expect(after.tagStates[2]).toBeUndefined()
  expect(after.cols[0]).toMatchObject({
    rule: [],
    exclude: [],
    ruleEnabled: false,
    ruleTagModes: {},
    ruleExcludeModes: {},
  })
  expect(after.parents).toEqual({ keep: 'other' })
  expect(after.collectionRevisions[id]).toBe(9)
  expect(before.tags).toHaveLength(1)
})
