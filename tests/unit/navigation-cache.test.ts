import { afterEach, expect, it, vi } from 'vitest'
import { MemoryCache } from '@/api/memory-cache'
import { LiveStore } from '@/api/live-store'
import {
  cachedArticle,
  clearReadingCache,
  clearOperationJournal,
  loadArticle,
  workspaceQueryKey,
} from '@/api/production'
import { article, workspace } from '../live/workspace-fixture'

const detail = {
  article: { ...article, body: ['Full article'], raw: 'Source' },
  tag_state: { revision: 3, content_revision: 1, decision_id: null, selection: {}, custom_tags: [] },
}
function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  clearReadingCache()
  clearOperationJournal()
})
it('bounds the cache by entries and encoded bytes, without extending freshness on reads', () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const cache = new MemoryCache<string, string>(2, 12, 1000)
  cache.set('a', 'a')
  cache.set('b', 'b')
  expect(cache.get('a')).toBe('a')
  cache.set('c', 'c')
  expect(cache.get('b')).toBeUndefined()
  cache.set('large', '中文中文')
  expect(cache.get('large')).toBeUndefined()
  vi.setSystemTime(600)
  expect(cache.get('a', 500)).toBeUndefined()
  expect(cache.get('a')).toBe('a')
  vi.setSystemTime(1000)
  expect(cache.get('a')).toBeUndefined()
  cache.set('a', 'aaaa')
  cache.set('b', 'bbbb')
  cache.set('c', 'c')
  expect(cache.get('a')).toBeUndefined()
  expect(cache.get('b')).toBe('bbbb')
  cache.clear()
  expect(cache.get('b')).toBeUndefined()
})
it('keys equivalent filters identically and keeps cursors and dates separate', () => {
  expect(workspaceQueryKey({ tags: ['b', 'a', 'a'], q: '  hi ' })).toBe(
    workspaceQueryKey({ tags: ['a', 'b'], q: 'hi', mode: 'any' }),
  )
  expect(workspaceQueryKey({ mode: 'all' })).toBe(workspaceQueryKey({ mode: 'any' }))
  expect(workspaceQueryKey({ cursor: 40 })).not.toBe(workspaceQueryKey({}))
  expect(workspaceQueryKey({ today: '2026-10-13' })).not.toBe(workspaceQueryKey({ today: '2026-10-14' }))
})
it('deduplicates a query, reuses fresh pages, and expires them after one minute', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const pending = deferred(),
    fetcher = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(() => Promise.resolve(Response.json(workspace())))
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore(),
    first = store.navigate({})
  const repeated = store.navigate({ mode: 'all' })
  expect(repeated).toBe(first)
  expect(fetcher).toHaveBeenCalledTimes(1)
  pending.resolve(Response.json(workspace()))
  await first
  await store.navigate({ range: '7' })
  await store.navigate({})
  expect(fetcher).toHaveBeenCalledTimes(2)
  vi.setSystemTime(60_001)
  await store.navigate({ range: '7' })
  await store.navigate({})
  expect(fetcher).toHaveBeenCalledTimes(4)
})
it('keeps content while refreshing and replaces it with an authoritative empty result', async () => {
  const pending = deferred(),
    fetcher = vi.fn().mockResolvedValueOnce(Response.json(workspace())).mockReturnValueOnce(pending.promise)
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  const refresh = store.refresh()
  expect(store.getSnapshot()).toMatchObject({ fetching: true, loading: false, pageIds: [1] })
  pending.resolve(Response.json(workspace({ items: [], total: 0 })))
  await refresh
  expect(store.getSnapshot()).toMatchObject({ fetching: false, pageIds: [], data: { arts: [] } })
})
it('does not let a cancelled response replace a newer filter or populate its cache', async () => {
  const slow = deferred(),
    fetcher = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(Response.json(workspace({ total: 2 })))
      .mockResolvedValueOnce(Response.json(workspace()))
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore(),
    old = store.navigate({ q: 'old' })
  await store.navigate({ q: 'new' })
  slow.resolve(Response.json(workspace({ total: 99 })))
  await old
  expect(store.getSnapshot().data.server?.total).toBe(2)
  await store.navigate({ q: 'old' })
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it('reuses each cursor independently when paging back', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(
        Response.json(workspace(path.includes('cursor=1') ? { items: [{ ...article, id: 2 }] } : { next_cursor: 1 })),
      ),
    )
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  await store.page(true)
  expect(store.getSnapshot().pageIds).toEqual([2])
  await store.page(false)
  expect(store.getSnapshot().pageIds).toEqual([1])
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('joins intent prefetch, remaps detail tags, and reopens a fresh article without a request', async () => {
  const pending = deferred(),
    fetcher = vi.fn().mockResolvedValueOnce(Response.json(workspace())).mockReturnValueOnce(pending.promise)
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  store.prefetch(1)
  const reading = store.read(1)
  expect(fetcher).toHaveBeenCalledTimes(2)
  pending.resolve(Response.json(detail))
  await reading
  await store.read(null)
  await store.read(1)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(store.getSnapshot().data.arts[0].raw).toBe('Source')
})
it('only reuses details when both summary revisions agree and never reuses revoked content', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(detail))
    .mockResolvedValueOnce(Response.json({ error: 'not_found' }, { status: 404 }))
  vi.stubGlobal('fetch', fetcher)
  await loadArticle(1, [])
  const summary = { ...detail.article, kind: 'article' as const }
  expect(cachedArticle(1, summary)).toBeDefined()
  expect(cachedArticle(1, { ...summary, personalRevision: 4 })).toBeUndefined()
  expect(cachedArticle(1, { ...summary, bodyRevision: 2 })).toBeUndefined()
  await expect(loadArticle(1, [])).rejects.toThrow()
  expect(cachedArticle(1, { ...detail.article, kind: 'article' })).toBeUndefined()
})
it('keeps a loaded article on transient refresh failure but removes it after revocation', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(workspace()))
    .mockResolvedValueOnce(Response.json(detail))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }))
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  await store.read(1)
  await store.read(1, true)
  expect(store.getSnapshot()).toMatchObject({ readingError: true, readyArticleId: 1 })
  await store.read(1, true)
  expect(store.getSnapshot().readyArticleId).toBeUndefined()
})
it('invalidates cached pages and reading details before edits and preserves an unsaved draft', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn()
    .mockImplementation((path: string) =>
      Promise.resolve(Response.json(path.startsWith('/api/workspace/') ? detail : workspace())),
    )
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  await store.read(1)
  await store.navigate({ range: '7' })
  store.setEditing(true)
  store.update('arts', (arts) => arts.map((a) => ({ ...a, title: 'Draft' })))
  expect(cachedArticle(1, { ...detail.article, kind: 'article' })).toBeUndefined()
  const count = fetcher.mock.calls.length
  await store.navigate({})
  await store.refresh()
  expect(fetcher).toHaveBeenCalledTimes(count)
  expect(store.getSnapshot().data.arts[0].title).toBe('Draft')
  await store.discard()
  expect(fetcher.mock.calls.length).toBeGreaterThan(count)
})
it('clears all visible data and caches when the workspace denies access', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(workspace()))
    .mockResolvedValueOnce(Response.json(detail))
    .mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 }))
  vi.stubGlobal('fetch', fetcher)
  const store = new LiveStore()
  await store.navigate({})
  await store.read(1)
  await store.refresh()
  expect(store.getSnapshot()).toMatchObject({ online: false, data: { arts: [] }, pageIds: [] })
  expect(cachedArticle(1, { ...detail.article, kind: 'article' })).toBeUndefined()
})

it('unlocks a committed deletion while summary refresh is slow and chains the next catalog revision', async () => {
  const refresh = deferred()
  const writes: Record<string, unknown>[] = []
  const data = workspace({
    catalog: {
      revision: 4,
      catalog: {
        topics: [
          { id: 'a', label: 'A', active: true, description: 'A', ai_enabled: true },
          { id: 'b', label: 'B', active: true, description: 'B', ai_enabled: true },
          { id: 'c', label: 'C', active: true, description: 'C', ai_enabled: true },
        ],
      },
    },
  })
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init: RequestInit) => {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body))
        writes.push(body)
        return Response.json({
          deletion: {
            tag_refs: ['system/topics/' + body.id],
            catalog_revision: 4 + writes.length,
            article_revisions: {},
            collection_revisions: {},
          },
        })
      }
      return ++reads === 1 ? Response.json(data) : refresh.promise
    }),
  )
  const store = new LiveStore()
  await store.navigate({})
  expect(await store.deleteItem({ kind: 'tag', id: 'system/topics/a' })).toBe(true)
  expect(store.getSnapshot()).toMatchObject({
    saving: false,
    dirty: false,
    fetching: true,
    data: { catalogRevision: 5 },
  })
  expect(store.getSnapshot().data.tags.map((t) => t.name)).toEqual(['B', 'C'])
  expect(await store.deleteItem({ kind: 'tag', id: 'system/topics/b' })).toBe(true)
  expect(writes.map((w) => w.expected_revision)).toEqual([4, 5])
  expect(store.getSnapshot().data.tags.map((t) => t.name)).toEqual(['C'])
  refresh.resolve(
    Response.json(workspace({ catalog: { revision: 6, catalog: { topics: [{ id: 'c', label: 'C' }] } } })),
  )
  await vi.waitFor(() => expect(store.getSnapshot().fetching).toBe(false))
  expect(store.getSnapshot().data.tags.map((t) => t.name)).toEqual(['C'])
})
it('retains a failed deletion and reuses its operation key on explicit retry', async () => {
  const writes: Record<string, unknown>[] = []
  const data = workspace({
    catalog: { revision: 4, catalog: { topics: [{ id: 'a', label: 'A', active: true, description: 'A' }] } },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init: RequestInit) => {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body))
        writes.push(body)
        if (writes.length === 1) return Response.json({ error: 'unavailable' }, { status: 503 })
        return Response.json({
          deletion: {
            tag_refs: ['system/topics/a'],
            catalog_revision: 5,
            article_revisions: {},
            collection_revisions: {},
          },
        })
      }
      return Response.json(writes.length > 1 ? workspace({ catalog: { revision: 5, catalog: {} } }) : data)
    }),
  )
  const store = new LiveStore()
  await store.navigate({})
  expect(await store.deleteItem({ kind: 'tag', id: 'system/topics/a' })).toBe(false)
  expect(store.getSnapshot()).toMatchObject({ saving: false, dirty: true, error: 'save' })
  expect(store.getSnapshot().data.tags).toHaveLength(1)
  await store.flush()
  expect(writes[0].operation_key).toBe(writes[1].operation_key)
  expect(store.getSnapshot()).toMatchObject({ saving: false, dirty: false })
  expect(store.getSnapshot().data.tags).toHaveLength(0)
})

it('revalidates before unlocking when a deletion receipt includes unseen concurrent catalog changes', async () => {
  const pending = deferred()
  const data = workspace({ catalog: { revision: 4, catalog: { topics: [{ id: 'a', label: 'A', description: 'A' }] } } })
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init: RequestInit) => {
      if (init.method === 'POST')
        return Response.json({
          deletion: {
            tag_refs: ['system/topics/a'],
            catalog_revision: 7,
            article_revisions: {},
            collection_revisions: {},
          },
        })
      return ++reads === 1 ? Response.json(data) : pending.promise
    }),
  )
  const store = new LiveStore()
  await store.navigate({})
  const deletion = store.deleteItem({ kind: 'tag', id: 'system/topics/a' })
  await vi.waitFor(() => expect(store.getSnapshot().reloadingAfterSave).toBe(true))
  expect(store.getSnapshot().saving).toBe(true)
  pending.resolve(
    Response.json(workspace({ catalog: { revision: 7, catalog: { topics: [{ id: 'b', label: 'Concurrent tag' }] } } })),
  )
  await deletion
  expect(store.getSnapshot().data.tags[0].name).toBe('Concurrent tag')
  expect(store.getSnapshot().saving).toBe(false)
})

it('clears a definitively rejected deletion so another item can be managed without discarding a draft', async () => {
  const data = workspace({
    catalog: {
      revision: 4,
      catalog: {
        topics: [
          { id: 'a', label: 'Keep' },
          { id: 'b', label: 'Remove' },
        ],
      },
    },
  })
  const writes: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path, init: RequestInit) => {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body))
        writes.push(body)
        if (body.id === 'a') return Response.json({ error: 'last_ai_tag' }, { status: 409 })
        return Response.json({
          deletion: {
            tag_refs: ['system/topics/b'],
            catalog_revision: 5,
            article_revisions: {},
            collection_revisions: {},
          },
        })
      }
      return Response.json(data)
    }),
  )
  const store = new LiveStore()
  await store.navigate({})
  expect(await store.deleteItem({ kind: 'tag', id: 'system/topics/a' })).toBe(false)
  expect(store.getSnapshot()).toMatchObject({
    saving: false,
    dirty: false,
    error: 'rejected',
    errorCode: 'last_ai_tag',
  })
  expect(store.getSnapshot().data.tags.map((t) => t.name)).toEqual(['Keep', 'Remove'])
  await store.flush()
  expect(writes).toHaveLength(1)
  expect(await store.deleteItem({ kind: 'tag', id: 'system/topics/b' })).toBe(true)
  expect(writes).toHaveLength(2)
})
