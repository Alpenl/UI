import source from './snapshot.json'
import type { Article } from '@/domain/library'
import { inRange } from '@/domain/library'
import type { ServerView } from '@/api/production'

type DesignData = {
  workspace: ServerView & {
    version: 1
    catalog: { parents?: Record<string, string> }
    collections: { id: string; revision: number; item_count: number; range_count: number }[]
    items: Article[]
  }
  details: Record<string, { article: Article; tag_state: unknown; body_unchanged: boolean }>
  overview: unknown
  classificationRuns: unknown
  collectionReads: Record<string, { candidates: unknown; preview: unknown }>
}
const snapshot = source as unknown as DesignData
const all = snapshot.workspace.items
const parents = snapshot.workspace.catalog.parents ?? {}

function hasTag(article: Article, ref: string, expand: boolean) {
  return article.tags.some((assigned) => {
    const visited = new Set<string>()
    for (let current: string | undefined = assigned; current && !visited.has(current); current = parents[current]) {
      if (current === ref) return true
      if (!expand) return false
      visited.add(current)
    }
    return false
  })
}
function workspace(params: URLSearchParams) {
  const kind = params.get('kind') ?? 'article'
  const base = all.filter((a) => a.kind === kind)
  const refs = JSON.parse(params.get('tags') ?? '[]') as string[]
  const modes = JSON.parse(params.get('tag_modes') ?? '{}') as Record<string, string>
  const search = (params.get('q') ?? '').trim().toLocaleLowerCase()
  const collection = params.get('collection')
  const filtered = base.filter((a) => {
    if (!inRange(a, params.get('range') ?? 'all')) return false
    if (params.get('quick') === 'todo' && !a.failed) return false
    if (collection && !(collection in a.cols)) return false
    if (search) {
      const detail = snapshot.details[a.id]?.article
      if (
        ![a.title, a.summary, a.url, detail?.raw, ...(detail?.body ?? [])]
          .join('\n')
          .toLocaleLowerCase()
          .includes(search)
      )
        return false
    }
    const matches = (ref: string) => hasTag(a, ref, modes[ref] === 'with_narrower')
    return !refs.length || (params.get('mode') === 'all' ? refs.every(matches) : refs.some(matches))
  })
  const tags: Record<string, number> = {}
  base.forEach((a) =>
    a.tags.forEach((ref) => {
      tags[ref] = (tags[ref] ?? 0) + 1
    }),
  )
  const days: Record<string, number> = {}
  filtered.forEach((a) => {
    days[a.date] = (days[a.date] ?? 0) + 1
  })
  // A cursor is the last item ID, matching the production contract.
  const cursor = params.get('cursor')
  const start = cursor ? Math.max(0, filtered.findIndex((a) => a.id === Number(cursor)) + 1) : 0
  const items = filtered.slice(start, start + 40)
  return {
    ...snapshot.workspace,
    total: filtered.length,
    next_cursor: start + items.length < filtered.length ? (items.at(-1)?.id ?? null) : null,
    items,
    collections: snapshot.workspace.collections.map((c) => ({
      ...c,
      item_count: base.filter((a) => c.id in a.cols).length,
      range_count: filtered.filter((a) => c.id in a.cols).length,
    })),
    facets: { total: base.length, failed: base.filter((a) => a.failed).length, tags },
    overview: {
      ...snapshot.workspace.overview,
      saved: filtered.length,
      tags: filtered.reduce((n, a) => n + a.tags.length, 0),
      placed: filtered.filter((a) => Object.keys(a.cols).length).length,
      latest_id: filtered[0]?.id ?? null,
      days: Object.entries(days)
        .sort()
        .map(([day, n]) => ({ day, n })),
      events: snapshot.workspace.overview.events.filter((e) => filtered.some((a) => a.id === e.id)),
      failed: filtered.filter((a) => a.failed),
    },
  }
}

/** Read-only, deterministic snapshot transport. There is deliberately no fetch fallback. */
export function readDesign(path: string): unknown {
  const url = new URL(path, 'https://design.invalid')
  const route = url.pathname.replace(/^\/api\/v1\//, '/api/')
  if (route === '/api/workspace') return structuredClone(workspace(url.searchParams))
  if (route === '/api/overview') return structuredClone(snapshot.overview)
  if (route === '/api/tag-system/classification/runs') return structuredClone(snapshot.classificationRuns)
  const detail = route.match(/^\/api\/workspace\/(\d+)$/)
  if (detail && snapshot.details[detail[1]]) return structuredClone(snapshot.details[detail[1]])
  const members = route.match(/^\/api\/workspace\/collections\/([^/]+)$/)
  if (members) {
    const collection = snapshot.workspace.collections.find((c) => c.id === members[1])
    if (!collection) throw new Error('design_collection_not_found')
    const values = all.filter((a) => collection.id in a.cols)
    return structuredClone({ revision: collection.revision, items: values, next_cursor: null, next_id: null })
  }
  const rules = route.match(/^\/api\/collections\/([^/]+)\/rules\/(candidates|preview)$/)
  if (rules && snapshot.collectionReads[rules[1]])
    return structuredClone(snapshot.collectionReads[rules[1]][rules[2] as 'candidates' | 'preview'])
  // Missing read endpoints must fail visibly, never contact a real backend.
  throw new Error('design_endpoint_not_available')
}
