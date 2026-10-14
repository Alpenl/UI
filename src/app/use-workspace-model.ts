import { LIVE, liveDimensions, operationKey, workspaceQueryKey } from '@/api/production'
import { liveStore, useLiveStore } from '@/api/live-store'
import { loadReader } from '@/features/library/reader-loader'
import { loadMediaPlayer } from '@/components/media/media-loader'
import { useRouteField } from '@/app/navigation'
import type { KS, Quick, SetTab } from '@/app/workspace-state'
import { EMPTY, matchQ } from '@/app/workspace-state'
import {
  DIMS0,
  DIM_PALETTE,
  KINDS,
  inRange,
  needsAttention,
  rangeLabel,
  type Article,
  type Collection,
  type Dim,
  type DimDef,
  type Kind,
  type Range,
  type Tag,
} from '@/domain/library'
import { articlesSchema, collectionsSchema, dimensionsSchema, onlineSchema, tagsSchema } from '@/domain/schemas'
import { localizeDimensions } from '@/features/tags/localize-dimensions'
import { usePersisted } from '@/hooks/use-persisted'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'
import { ARTS0, COLS0, TAGS0 } from '@/mocks/fixtures'
import { useEffect, useMemo, useRef, useState } from 'react'
export function useWorkspaceModel() {
  const { t: translate } = useTranslation()
  const [view, setView] = useRouteField('view')
  const [kind, setKind] = useRouteField('kind')
  const [demoTags, setDemoTags] = usePersisted<Tag[]>('tags', LIVE ? [] : TAGS0, tagsSchema, !LIVE)
  const [demoCols, setDemoCols] = usePersisted<Collection[]>('cols', LIVE ? [] : COLS0, collectionsSchema, !LIVE)
  const [demoArts, setDemoArts] = usePersisted<Article[]>('arts-v3', LIVE ? [] : ARTS0, articlesSchema, !LIVE)
  const live = useLiveStore()
  useEffect(() => {
    if (!LIVE || !live.data.server?.reconciling || live.fetching || live.dirty || live.saving) return
    const timer = setTimeout(() => void liveStore.refresh(), 3000)
    return () => clearTimeout(timer)
  }, [live.data.server?.reconciling, live.data.server?.revision, live.fetching, live.dirty, live.saving])
  const tags = LIVE ? live.data.tags : demoTags
  const cols = LIVE ? live.data.cols : demoCols
  const arts = LIVE ? live.data.arts : demoArts
  const setTags = LIVE ? live.setTags : setDemoTags
  const setCols = LIVE ? live.setCols : setDemoCols
  const setArts = LIVE ? live.setArts : setDemoArts
  const [ks, setKs] = useRouteField('filters')
  const [storedDims, setDemoDims] = usePersisted<DimDef[]>('dims', DIMS0, dimensionsSchema, !LIVE)
  const setDims = LIVE ? live.setDims : setDemoDims
  const dims = LIVE
    ? (live.data.dims ?? liveDimensions())
        .filter((d) => !d.archived)
        .map((d) =>
          d.revision === undefined ? { ...d, label: liveDimensions().find((x) => x.id === d.id)?.label ?? d.label } : d,
        )
    : localizeDimensions(storedDims)
  const [mode, setMode] = useRouteField('matchMode')
  const [openDims, setOpenDims] = useState<Dim[]>(['topic'])
  const [navOpen, setNavOpen] = useState(false)
  const [setTab, setSetTab] = useRouteField('tab')
  const [hubKind, setHubKind] = useRouteField('collectionKind')
  const openSettings = (t: SetTab) => {
    setNavOpen(false)
    setSetTab(t)
    setHubKind(kind)
    setView('set')
  }
  const [draft, setDraft] = useState<{ dim: Dim; name: string; err: string } | null>(null)
  const dimLabel = (id: Dim) => dims.find((d) => d.id === id)?.label ?? translate('app:uncategorized')
  const createTag = (dim: Dim, raw: string): string | null => {
    const name = raw.trim()
    if (!name) return translate('app:nameIsRequired')
    const dup = tags.find((t) => t.name === name)
    if (dup) return translate('app:alreadyExistsIn', { type: dimLabel(dup.dim) })
    setTags((x) => [...x, { name, dim, auto: !LIVE, enabled: true, aliases: '', desc: LIVE ? name : '', user: true }])
    return null
  }
  const [demoOnline, setDemoOnline] = usePersisted('online', false, onlineSchema, !LIVE)
  const online = LIVE ? live.online : demoOnline
  const setOnline = LIVE
    ? () => {
        void liveStore.refresh()
      }
    : setDemoOnline
  const kArts = useMemo(() => arts.filter((a) => a.kind === kind), [arts, kind])
  const kCols = useMemo(() => cols.filter((c) => c.kind === kind && !c.deleted), [cols, kind])
  const { q, quick, fTags, sel, range } = ks[kind]
  const fCol = LIVE
    ? ks[kind].fCol
    : ks[kind].fCol && kCols.some((c) => c.id === ks[kind].fCol && !c.archived)
      ? ks[kind].fCol
      : null
  const patch = (p: Partial<KS>, k: Kind = kind) => setKs((x) => ({ ...x, [k]: { ...x[k], ...p } }))
  const setQ = (v: string) => patch({ q: v })
  const setQuick = (v: Quick) => patch({ quick: v })
  const setSel = (id: number | null) => patch({ sel: id })
  const setRange = (r: Range) => patch({ range: r })
  const goCol = (id: string) => patch({ quick: 'all', fCol: id, fTags: [], q: '', sel: null })
  // Unknown names must not turn a filtered URL into an unfiltered request while
  // the catalog is loading (or after a tag has been removed).
  const tagRefs = fTags.map((name) => tags.find((t) => t.name === name)?.ref ?? 'system/topics/__unresolved__')
  const queryKey = workspaceQueryKey({
    q: q.trim(),
    quick,
    range,
    tags: tagRefs,
    ...(live.data.relationsVersion === 1
      ? { tag_modes: Object.fromEntries(tagRefs.map((ref) => [ref, ks[kind].tagScopes?.[ref] ?? 'exact'])) }
      : {}),
    mode,
    collection: fCol ?? undefined,
    kind,
    today: new Date().toLocaleDateString('en-CA'),
  })
  const queryPending = LIVE && (live.loading || live.resultKey !== queryKey)
  const queryFailed = queryPending && live.error === 'load' && !live.fetching
  const previousSearch = useRef(q.trim())
  useEffect(() => {
    if (!LIVE) return
    const changedSearch = previousSearch.current !== q.trim()
    previousSearch.current = q.trim()
    if (!changedSearch) {
      void liveStore.navigate(JSON.parse(queryKey))
      return
    }
    const timer = setTimeout(() => void liveStore.navigate(JSON.parse(queryKey)), 180)
    return () => clearTimeout(timer)
  }, [queryKey, q])
  useEffect(() => {
    if (!LIVE) return
    const reading = view === 'lib' && kind === 'article' ? sel : null
    if (reading) void loadReader().catch(() => {})
    void liveStore.read(reading)
  }, [sel, view, kind])
  useEffect(() => {
    if (!LIVE || view !== 'lib' || kind !== 'article' || live.readyArticleId !== sel) return
    const media = live.data.arts.find((article) => article.id === sel)?.media
    if (media?.some((item) => item.status === 'ready' && item.content_type !== 'application/zip'))
      void loadMediaPlayer().catch(() => {})
  }, [view, kind, sel, live.readyArticleId, live.data.arts])
  const dimOf = (n: string): Dim => tags.find((t) => t.name === n)?.dim ?? dims[0]?.id ?? 'topic'
  const update = (id: number, f: (a: Article) => Article) => setArts((x) => x.map((a) => (a.id === id ? f(a) : a)))
  const renameTag = (from: string, to: string): string | null => {
    const name = to.trim()
    if (!name) return translate('app:nameIsRequired')
    if (name === from) return null
    const target = tags.find((t) => t.name === from)
    const p1 = LIVE && live.data.classificationVersion === 1
    if (
      tags.some(
        (t) =>
          t.name !== from &&
          (t.name === name || (t as { sourceLabel?: string }).sourceLabel === name) &&
          (!p1 || t.dim === target?.dim),
      )
    )
      return translate('app:tagAlreadyExists', { name })
    const duplicate =
      p1 &&
      tags.some((t) => t.name !== from && (t.name === name || (t as { sourceLabel?: string }).sourceLabel === name))
    const viewName = duplicate ? `${name} · ${dims.find((d) => d.id === target?.dim)?.label ?? target?.dim}` : name
    setTags((x) =>
      x.map((t) => (t.name === from ? { ...t, name: viewName, ...(p1 ? { displayLabel: name } : {}) } : t)),
    )
    const swap = (l: string[]) => l.map((t) => (t === from ? viewName : t))
    setArts((x) =>
      x.map((a) =>
        a.tags.includes(from) || a.excluded.includes(from)
          ? { ...a, tags: swap(a.tags), excluded: swap(a.excluded) }
          : a,
      ),
    )
    setCols((x) => x.map((c) => ({ ...c, rule: swap(c.rule), ...(c.exclude ? { exclude: swap(c.exclude) } : {}) })))
    setKs((x) => ({
      article: { ...x.article, fTags: swap(x.article.fTags) },
      site: { ...x.site, fTags: swap(x.site.fTags) },
    }))
    return null
  }
  const deleteTags = async (names: string[]) => {
    if (LIVE && !liveStore.getSnapshot().dirty && names.length === 1) {
      const tag = tags.find((t) => t.name === names[0])
      if (tag?.ref && !tag.ref.startsWith('draft/')) {
        const ok = await liveStore.deleteItem({ kind: 'tag', id: tag.ref })
        if (ok)
          setKs((x) => ({
            article: { ...x.article, fTags: x.article.fTags.filter((n) => !names.includes(n)) },
            site: { ...x.site, fTags: x.site.fTags.filter((n) => !names.includes(n)) },
          }))
        return ok
      }
    }
    const gone = new Set(names)
    const drop = (l: string[]) => l.filter((t) => !gone.has(t))
    setTags((x) =>
      LIVE
        ? x.map((t) => (gone.has(t.name) ? { ...t, enabled: false, deleteRequested: true } : t))
        : x.filter((t) => !gone.has(t.name)),
    )
    setArts((x) =>
      x.map((a) =>
        a.tags.some((t) => gone.has(t)) || a.excluded.some((t) => gone.has(t))
          ? { ...a, tags: drop(a.tags), excluded: drop(a.excluded) }
          : a,
      ),
    )
    setCols((x) =>
      x.map((c) => ({
        ...c,
        rule: drop(c.rule),
        exclude: drop(c.exclude ?? []),
        ...(LIVE && [...c.rule, ...(c.exclude ?? [])].some((name) => gone.has(name)) ? { ruleEnabled: false } : {}),
      })),
    )
    setKs((x) => ({
      article: { ...x.article, fTags: drop(x.article.fTags) },
      site: { ...x.site, fTags: drop(x.site.fTags) },
    }))
    if (LIVE) void liveStore.flush()
    return true
  }
  const dimErr = (label: string, self?: string) => {
    const n = label.trim()
    if (!n) return translate('app:nameIsRequired')
    if (dims.some((d) => d.id !== self && d.label === n)) return translate('app:typeAlreadyExists', { name: n })
    return null
  }
  const addDim = (label: string): { id?: string; err?: string } => {
    const err = dimErr(label)
    if (err) return { err }
    const id = LIVE ? operationKey() : 'd' + Date.now().toString(36)
    setDims((x) => [...x, { id, label: label.trim(), chip: DIM_PALETTE[x.length % DIM_PALETTE.length], auto: true }])
    return { id }
  }
  const renameDim = (id: string, label: string) => {
    const err = dimErr(label, id)
    if (!err) setDims((x) => x.map((d) => (d.id === id ? { ...d, label: label.trim() } : d)))
    return err
  }
  const recolorDim = (id: string, chip: string) => setDims((x) => x.map((d) => (d.id === id ? { ...d, chip } : d)))
  const deleteDim = async (id: string) => {
    if (LIVE) {
      if (liveStore.getSnapshot().dirty) {
        await liveStore.flush()
        if (liveStore.getSnapshot().dirty) return false
      }
      const ok = await liveStore.deleteItem({ kind: 'dimension', id })
      if (!ok) return false
      const gone = new Set(tags.filter((t) => t.dim === id).map((t) => t.name))
      setKs((x) => ({
        article: { ...x.article, fTags: x.article.fTags.filter((n) => !gone.has(n)) },
        site: { ...x.site, fTags: x.site.fTags.filter((n) => !gone.has(n)) },
      }))
    } else {
      await deleteTags(tags.filter((t) => t.dim === id).map((t) => t.name))
      setDims((x) => x.filter((d) => d.id !== id))
    }
    setOpenDims((x) => x.filter((y) => y !== id))
    return true
  }
  const deleteCol = (id: string) => {
    setCols((x) => (LIVE ? x.map((c) => (c.id === id ? { ...c, deleted: true } : c)) : x.filter((c) => c.id !== id)))
    setArts((x) =>
      x.map((a) =>
        id in a.cols ? { ...a, cols: Object.fromEntries(Object.entries(a.cols).filter(([k]) => k !== id)) } : a,
      ),
    )
    setKs((x) => ({
      article: x.article.fCol === id ? { ...x.article, fCol: null } : x.article,
      site: x.site.fCol === id ? { ...x.site, fCol: null } : x.site,
    }))
  }
  const shown = useMemo(() => {
    if (LIVE) {
      if (queryPending) return []
      const byId = new Map(arts.map((a) => [a.id, a]))
      return (live.pageIds ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
    }
    const k = q.trim().toLowerCase()
    return kArts.filter((a) => {
      if (quick === 'todo' && !needsAttention(a)) return false
      if (!matchQ(a, k)) return false
      if (!inRange(a, range)) return false
      if (
        fTags.length &&
        !(mode === 'any' ? fTags.some((t) => a.tags.includes(t)) : fTags.every((t) => a.tags.includes(t)))
      )
        return false
      if (fCol && !(fCol in a.cols)) return false
      return true
    })
  }, [kArts, q, quick, fTags, mode, fCol, range, arts, live.pageIds, queryPending])
  const otherHits = useMemo(() => {
    if (LIVE) return []
    const k = q.trim().toLowerCase()
    if (!k) return []
    return (Object.keys(KINDS) as Kind[])
      .filter((x) => x !== kind)
      .map((x) => ({ kind: x, n: arts.filter((a) => a.kind === x && matchQ(a, k)).length }))
      .filter((h) => h.n > 0)
  }, [arts, q, kind])
  const filtering = quick !== 'all' || range !== 'all' || !!fCol || fTags.length > 0 || !!q.trim()
  const clear = () => patch({ quick: 'all', fCol: null, fTags: [], q: '', range: 'all' })
  const pickKind = (k: Kind) => {
    setNavOpen(false)
    if (k !== kind) {
      setKind(k)
      if (view !== 'lib') setView('lib')
    } else {
      setView('lib')
      patch({ ...EMPTY })
    }
  }
  const jump = (k: Kind) => {
    patch({ q }, k)
    setKind(k)
    setView('lib')
  }
  const [backTo, setBackTo] = useState<{ siteId: number; artId: number } | null>(null)
  const openItem = (id: number, fromId?: number) => {
    const it = arts.find((a) => a.id === id)
    if (!it) {
      if (LIVE) {
        setKind('article')
        setView('lib')
        patch({ sel: id }, 'article')
      }
      return
    }
    setBackTo(fromId !== undefined && it.kind === 'site' ? { siteId: id, artId: fromId } : null)
    setKind(it.kind)
    setView('lib')
    patch({ sel: id }, it.kind)
  }
  const goLib = (f: () => void) => {
    setNavOpen(false)
    setView('lib')
    f()
  }
  const toggleTag = (n: string) =>
    goLib(() => {
      const adding = !fTags.includes(n)
      const ref = tags.find((t) => t.name === n)?.ref
      patch({
        fTags: adding ? [...fTags, n] : fTags.filter((y) => y !== n),
        ...(adding && ref && live.data.relationsVersion === 1
          ? { tagScopes: { ...ks[kind].tagScopes, [ref]: 'with_narrower' as const } }
          : {}),
      })
      const d = tags.find((t) => t.name === n)?.dim
      if (adding && d) setOpenDims((x) => (x.includes(d) ? x : [...x, d]))
    })
  const backToArticle = backTo && kind === 'site' && sel === backTo.siteId ? () => openItem(backTo.artId) : undefined
  const activeCols = kCols.filter((c) => !c.archived).sort((a, b) => +b.pinned - +a.pinned)
  const heading = fCol
    ? (cols.find((c) => c.id === fCol)?.name ?? translate('app:collectionsHeading'))
    : quick === 'todo'
      ? translate('app:needsAttention')
      : fTags.length
        ? translate('app:filteredTags', {
            tags: fTags.join(' ' + (mode === 'any' ? translate('app:or') : translate('app:and')) + ' '),
          })
        : q.trim()
          ? translate('app:searchResults')
          : range !== 'all'
            ? translate('app:saved', { range: rangeLabel(range) })
            : translate('app:allByKind', { kind: KINDS[kind].label })
  const server = LIVE ? live.data.server : undefined
  const todo = server ? (kind === 'article' ? server.facets.failed : 0) : kArts.filter(needsAttention).length
  const libProps = {
    server: queryPending ? undefined : server,
    loading: queryPending && !queryFailed,
    loadingError: queryFailed,
    retryLoading: () => void liveStore.refresh(),
    fetching: LIVE && live.fetching,
    reading: LIVE && (live.selected !== sel || (live.readyArticleId !== sel && !live.readingError)),
    readingError: LIVE && live.readingError && live.readyArticleId !== sel,
    readingRefreshError: LIVE && live.readingError && live.readyArticleId === sel,
    prefetch: LIVE
      ? (id: number) => {
          void loadReader().catch(() => {})
          liveStore.prefetch(id)
        }
      : undefined,
    retryReading: () => void liveStore.read(sel, true),
    previousPage: LIVE && live.previousCursor ? () => liveStore.page(false) : undefined,
    nextPage: LIVE && server?.next_cursor ? () => liveStore.page(true) : undefined,
    range,
    setRange,
    goCol,
    kind,
    arts: kArts,
    allArts: arts,
    shown,
    tags,
    cols: kCols,
    q,
    setQ,
    sel,
    setSel,
    update,
    dimOf,
    heading,
    filtering,
    clear,
    quick,
    setQuick,
    todo,
    otherHits,
    jump,
    openItem,
    fTags,
    toggleTag,
    backToArticle,
  }
  return {
    server,
    live,
    translate,
    view,
    kind,
    tags,
    setTags,
    cols,
    setCols,
    arts,
    setArts,
    dims,
    mode,
    setMode,
    openDims,
    setOpenDims,
    navOpen,
    setNavOpen,
    setTab,
    setSetTab,
    hubKind,
    setHubKind,
    openSettings,
    draft,
    setDraft,
    createTag,
    online,
    setOnline,
    kArts,
    kCols,
    q,
    quick,
    fTags,
    fCol,
    patch,
    renameTag,
    deleteTags,
    addDim,
    renameDim,
    recolorDim,
    deleteDim,
    deleteCol,
    pickKind,
    goLib,
    toggleTag,
    activeCols,
    todo,
    libProps,
  }
}
export type WorkspaceModel = ReturnType<typeof useWorkspaceModel>
