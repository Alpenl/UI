import { useEffect, useSyncExternalStore, type SetStateAction } from 'react'
import { MemoryCache } from './memory-cache'
import type { Article, Collection, Tag, DimDef } from '@/domain/library'
import {
  BackendError,
  deleteCatalogItem,
  applyDeletion,
  type DeletionIntent,
  LIVE,
  clearOperationJournal,
  fields,
  operationKey,
  collectionAction,
  loadSnapshot,
  loadArticle,
  cachedArticle,
  clearReadingCache,
  mapDetail,
  normalizeWorkspaceQuery,
  workspaceQueryKey,
  type WorkspaceQuery,
  saveChanges,
  saveSingleCatalogEdit,
  type LiveTag,
  type Snapshot,
} from './production'

const empty: Snapshot = { arts: [], cols: [], tags: [], tagStates: {}, collectionRevisions: {}, catalogRevision: 0 }
type State = {
  data: Snapshot
  loading: boolean
  fetching: boolean
  readingFetching?: boolean
  readyArticleId?: number
  resultRequestKey?: string
  saving: boolean
  reloadingAfterSave?: boolean
  dirty: boolean
  error: 'load' | 'save' | 'conflict' | 'unsupported' | 'rejected' | 'validation' | null
  errorCode?: string
  online: boolean
  pageIds?: number[]
  reading?: boolean
  readingError?: boolean
  selected?: number | null
  previousCursor?: number
  resultKey?: string
}
export class LiveStore {
  private state: State = {
    data: empty,
    loading: true,
    fetching: false,
    saving: false,
    dirty: false,
    error: null,
    online: false,
  }
  private query: WorkspaceQuery = {}
  private queryKey = ''
  private controller: AbortController | undefined
  private readerController: AbortController | undefined
  private cursors: number[] = []
  private pages = new MemoryCache<string, Snapshot>(8, 2 * 1024 * 1024, 60_000)
  private flightKey = ''
  private readerFlight: Promise<void> | undefined
  private prefetchFlight:
    { id: number; controller: AbortController; promise: ReturnType<typeof loadArticle> } | undefined
  private pendingDeletion: DeletionIntent | undefined
  private editing = false
  private base = empty
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private flight: Promise<void> | undefined
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.state
  private patch(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }
  navigate = (query: WorkspaceQuery) => {
    const normalized = normalizeWorkspaceQuery(query)
    const key = workspaceQueryKey(normalized)
    if (this.queryKey === key) return this.flight ?? Promise.resolve()
    this.queryKey = key
    this.query = normalized
    this.cursors = []
    return this.loadPage(false)
  }
  page = (next: boolean) => {
    if (this.state.fetching || this.state.dirty || this.state.saving) return
    if (next) {
      if (!this.state.data.server?.next_cursor) return
      this.cursors.push(this.query.cursor ?? 0)
      this.query = { ...this.query, cursor: this.state.data.server.next_cursor }
    } else {
      this.query = { ...this.query, cursor: this.cursors.pop() ?? 0 }
    }
    return this.loadPage(false)
  }
  private applySnapshot(data: Snapshot, resultKey: string, requestKey: string) {
    const id = this.state.selected
    const summary = data.arts.find((a) => a.id === id)
    const cached = id ? cachedArticle(id, summary) : undefined
    const existing = this.state.readyArticleId === id ? this.state.data.arts.find((a) => a.id === id) : undefined
    // Retain a currently open detail only when the new summary agrees with it.
    const current =
      existing &&
      (!summary ||
        (summary.bodyRevision !== undefined &&
          existing.bodyRevision === summary.bodyRevision &&
          existing.personalRevision === summary.personalRevision))
    const detail = cached
      ? mapDetail(cached, data.tags)
      : current && id
        ? { article: existing, state: this.state.data.tagStates[id] }
        : undefined
    const pageIds = data.arts.map((a) => a.id)
    const merged =
      detail && id
        ? {
            ...data,
            arts: pageIds.includes(id)
              ? data.arts.map((a) => (a.id === id ? detail.article : a))
              : [...data.arts, detail.article],
            tagStates: { ...data.tagStates, [id]: detail.state },
          }
        : data
    this.base = merged
    this.patch({
      data: merged,
      resultKey,
      resultRequestKey: requestKey,
      pageIds,
      previousCursor: this.cursors.length,
      loading: false,
      readyArticleId: detail ? id! : undefined,
    })
    if (id && !detail && !this.readerFlight) void this.read(id, true)
  }
  private loadPage(force: boolean) {
    if (this.state.dirty || this.state.saving) return Promise.resolve()
    const requestKey = workspaceQueryKey(this.query)
    if (this.flight && this.flightKey === requestKey && !this.controller?.signal.aborted) return this.flight
    this.controller?.abort()
    const resultKey = this.queryKey
    const cached = force ? undefined : this.pages.get(requestKey)
    if (cached) {
      this.flight = undefined
      this.applySnapshot(cached, resultKey, requestKey)
      this.patch({ fetching: false, error: null })
      return Promise.resolve()
    }
    const controller = new AbortController()
    this.controller = controller
    this.flightKey = requestKey
    this.patch({ loading: this.state.resultRequestKey !== requestKey, fetching: true, error: null })
    this.flight = loadSnapshot(this.query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || this.state.dirty || this.state.saving) return
        this.pages.set(requestKey, data)
        this.applySnapshot(data, resultKey, requestKey)
        this.patch({ online: true, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof BackendError && [401, 403].includes(error.status)) {
          this.pages.clear()
          clearReadingCache()
          this.readerController?.abort()
          this.prefetchFlight?.controller.abort()
          this.base = empty
          this.patch({
            data: empty,
            pageIds: [],
            resultKey: undefined,
            resultRequestKey: undefined,
            readyArticleId: undefined,
          })
        }
        this.patch({ error: 'load', online: false })
      })
      .finally(() => {
        if (this.controller === controller) {
          this.flight = undefined
          this.patch({ loading: false, fetching: false })
        }
      })
    return this.flight
  }
  refresh = async (_reuseTags = false) => {
    if (this.state.dirty || this.state.saving) return
    this.pages.clear()
    await this.loadPage(true)
    if (this.state.selected && this.state.online) await this.read(this.state.selected, true)
  }
  prefetch = (id: number) => {
    const summary = this.state.data.arts.find((a) => a.id === id)
    if (
      this.state.dirty ||
      this.state.saving ||
      this.state.fetching ||
      this.state.selected === id ||
      cachedArticle(id, summary)
    )
      return
    if (this.prefetchFlight?.id === id) return
    if (this.prefetchFlight?.id !== this.state.selected) this.prefetchFlight?.controller.abort()
    const controller = new AbortController()
    const promise = loadArticle(id, [], controller.signal)
    const flight = { id, controller, promise }
    this.prefetchFlight = flight
    void promise
      .catch(() => {})
      .finally(() => {
        if (this.prefetchFlight === flight) this.prefetchFlight = undefined
      })
  }
  private applyDetail(id: number, result: Awaited<ReturnType<typeof loadArticle>>) {
    const names = new Map(this.state.data.tags.map((tag) => [tag.ref, tag.name]))
    const article = {
      ...result.article,
      tags: result.article.tags.map((tag) => names.get(tag) ?? tag),
      excluded: result.article.excluded.map((tag) => names.get(tag) ?? tag),
    }
    const merge = (data: Snapshot) => {
      const page = data.arts.filter((a) => (this.state.pageIds ?? []).includes(a.id))
      return {
        ...data,
        arts: page.some((a) => a.id === id) ? page.map((a) => (a.id === id ? article : a)) : [...page, article],
        tagStates: { ...data.tagStates, [id]: result.state },
      }
    }
    this.base = merge(this.base)
    this.patch({ data: merge(this.state.data), readyArticleId: id, reading: false })
  }
  read = (id: number | null, force = false): Promise<void> => {
    if (this.state.selected === id && this.readerFlight && !this.readerController?.signal.aborted)
      return this.readerFlight
    if (!force && this.state.selected === id && !this.state.readingError) return Promise.resolve()
    this.readerController?.abort()
    this.readerFlight = undefined
    const existing = this.state.readyArticleId === id
    this.patch({ selected: id, reading: !!id && !existing, readingError: false, readingFetching: false })
    if (!id) return Promise.resolve()
    const cached =
      !force &&
      cachedArticle(
        id,
        this.state.data.arts.find((a) => a.id === id),
      )
    if (cached) {
      this.applyDetail(id, mapDetail(cached, []))
      return Promise.resolve()
    }
    const controller = new AbortController()
    this.readerController = controller
    this.patch({ readingFetching: true })
    const pending =
      this.prefetchFlight?.id === id ? this.prefetchFlight.promise : loadArticle(id, [], controller.signal)
    this.readerFlight = pending
      .then((result) => {
        if (controller.signal.aborted || this.state.dirty || this.state.saving) return
        this.applyDetail(id, result)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const revoked = error instanceof BackendError && [401, 403, 404].includes(error.status)
        if (revoked) {
          this.pages.clear()
          this.patch({ readyArticleId: undefined })
        }
        this.patch({ readingError: true })
      })
      .finally(() => {
        if (this.readerController === controller) {
          this.readerFlight = undefined
          this.patch({ reading: false, readingFetching: false })
        }
      })
    return this.readerFlight
  }
  private invalidateReads() {
    this.pages.clear()
    clearReadingCache()
    this.controller?.abort()
    this.readerController?.abort()
    this.prefetchFlight?.controller.abort()
    this.prefetchFlight = undefined
    this.readerFlight = undefined
    this.patch({ loading: false, fetching: false, reading: false, readingFetching: false })
  }
  unsupported = () => {
    this.patch({ error: 'unsupported' })
  }
  setEditing = (editing: boolean) => {
    this.editing = editing
    if (editing) clearTimeout(this.timer)
    else if (this.state.dirty && !this.state.error) {
      clearTimeout(this.timer)
      // Editor cleanup/setup can occur together; defer until the final editing state.
      this.timer = setTimeout(() => {
        if (!this.editing) void this.flush()
      }, 0)
    }
  }
  discard = async () => {
    this.pendingDeletion = undefined
    clearTimeout(this.timer)
    clearOperationJournal()
    this.patch({ dirty: false, error: null, data: this.base })
    await this.refresh()
  }
  action = async (id: string, type: string, data: object = {}) => {
    if (this.state.dirty || this.state.saving) return
    this.invalidateReads()
    this.patch({ saving: true, error: null })
    try {
      await collectionAction(id, this.base.collectionRevisions[id], type, data)
      clearOperationJournal()
    } catch (e) {
      this.patch({
        error: e instanceof BackendError && e.code === 'revision_conflict' ? 'conflict' : 'save',
        errorCode: e instanceof BackendError ? e.code : undefined,
      })
    }
    const error = this.state.error
    this.patch({ saving: false })
    await this.refresh(true)
    if (error) this.patch({ error })
  }
  // Explicit deletion bypasses the edit debounce. A committed receipt unlocks
  // controls before optional summary/statistics revalidation finishes.
  deleteItem = async (intent: DeletionIntent): Promise<boolean> => {
    if (this.state.saving || (this.state.dirty && !this.pendingDeletion)) return false
    if (this.pendingDeletion && JSON.stringify(this.pendingDeletion) !== JSON.stringify(intent)) return false
    this.pendingDeletion = intent
    clearTimeout(this.timer)
    this.invalidateReads()
    this.patch({ saving: true, error: null, errorCode: undefined })
    let receipt
    try {
      receipt = await deleteCatalogItem(this.base, intent)
    } catch (e) {
      // These explicit policy rejections roll back the entire single command.
      // There is no partial draft to retry, unlike a timeout or a batch save.
      if (e instanceof BackendError && ['last_ai_tag', 'system_dimension_fixed'].includes(e.code)) {
        this.pendingDeletion = undefined
        clearOperationJournal()
        this.patch({ saving: false, dirty: false, error: 'rejected', errorCode: e.code })
        return false
      }
      this.patch({
        saving: false,
        dirty: true,
        error: e instanceof BackendError && e.code === 'revision_conflict' ? 'conflict' : 'save',
        errorCode: e instanceof BackendError ? e.code : undefined,
      })
      return false
    }
    const versionsMatch =
      receipt &&
      receipt.catalog_revision === this.base.catalogRevision + 1 &&
      Object.entries(receipt.collection_revisions).every(
        ([id, revision]) =>
          this.base.collectionRevisions[id] === undefined || revision === this.base.collectionRevisions[id] + 1,
      ) &&
      this.base.arts.every(
        (article) =>
          receipt.article_revisions[article.id] === undefined ||
          receipt.article_revisions[article.id] === (article.personalRevision ?? -1) + 1,
      )
    if (receipt && versionsMatch) {
      this.base = applyDeletion(this.base, receipt)
      this.pendingDeletion = undefined
      clearOperationJournal()
      this.patch({ data: this.base, saving: false, dirty: false, error: null, online: true })
      void this.loadPage(true)
      return true
    }
    // Older NAS servers have no receipt. A jumped catalog revision also needs
    // a fresh snapshot, so unrelated concurrent edits cannot inherit a new
    // expected revision without first being seen. Preserve both revision guards.
    this.patch({ reloadingAfterSave: true })
    try {
      const resultKey = this.queryKey,
        requestKey = workspaceQueryKey(this.query)
      const data = await loadSnapshot(this.query)
      this.pendingDeletion = undefined
      clearOperationJournal()
      this.patch({ saving: false, reloadingAfterSave: false, dirty: false, error: null, online: true })
      if (resultKey === this.queryKey) this.applySnapshot(data, resultKey, requestKey)
      else await this.loadPage(true)
      return true
    } catch {
      this.patch({ saving: false, reloadingAfterSave: false, dirty: true, error: 'load', online: false })
      return false
    }
  }
  update<K extends 'arts' | 'cols' | 'tags' | 'dims'>(key: K, value: SetStateAction<Snapshot[K]>) {
    if (this.state.saving || (this.state.dirty && this.state.error && this.state.error !== 'validation')) return

    const previous = this.state.data[key]
    const next = typeof value === 'function' ? value(previous) : value
    if (
      next === previous ||
      (Array.isArray(next) &&
        Array.isArray(previous) &&
        next.length === previous.length &&
        next.every((value, i) => value === previous[i]))
    )
      return
    this.invalidateReads()
    this.patch({ data: { ...this.state.data, [key]: next }, dirty: true, error: null })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (!this.editing) void this.flush()
    }, 700)
  }
  async flush() {
    if (this.pendingDeletion) {
      await this.deleteItem(this.pendingDeletion)
      return
    }
    if (!this.state.dirty || this.state.saving) return
    clearTimeout(this.timer)
    this.patch({ saving: true, error: null, errorCode: undefined })
    let singleCommand = true
    try {
      const saved = await saveSingleCatalogEdit(this.base, this.state.data)
      if (saved) {
        this.base = saved
        clearOperationJournal()
        this.patch({ data: saved, saving: false, dirty: false, error: null, errorCode: undefined, online: true })
        void this.loadPage(true)
        return
      }
      singleCommand = false
      await saveChanges(this.base, this.state.data)
    } catch (e) {
      if (e instanceof BackendError && e.code === 'catalog_receipt_changed') {
        // The command committed but concurrent catalog changes require a read.
        clearOperationJournal()
        this.patch({ saving: false, dirty: false, error: null })
        await this.loadPage(true)
        return
      }
      // Preserve both the draft and its operation identities. Explicit retry can
      // replay a partially committed batch without creating duplicate resources.
      this.patch({
        saving: false,
        error:
          e instanceof BackendError && ['revision_conflict', 'decision_conflict'].includes(e.code)
            ? 'conflict'
            : singleCommand &&
                e instanceof BackendError &&
                [
                  'classification_change_required',
                  'invalid_ai_label',
                  'invalid_tag_definition',
                  'tag_collision',
                ].includes(e.code)
              ? 'validation'
              : 'save',
        errorCode: e instanceof BackendError ? e.code : undefined,
      })
      return
    }
    this.patch({ reloadingAfterSave: true })
    try {
      const resultKey = this.queryKey
      const requestKey = workspaceQueryKey(this.query)
      const data = await loadSnapshot(this.query)
      clearOperationJournal()
      this.patch({ saving: false, reloadingAfterSave: false, dirty: false, error: null, online: true })
      this.pages.clear()
      if (resultKey !== this.queryKey) await this.loadPage(true)
      else {
        this.pages.set(requestKey, data)
        this.applySnapshot(data, resultKey, requestKey)
      }
      if (this.state.selected) await this.read(this.state.selected, true)
    } catch {
      this.patch({ saving: false, reloadingAfterSave: false, error: 'load', online: false })
    }
  }
}
export const liveStore = new LiveStore()
export function useLiveStore() {
  const state = useSyncExternalStore(liveStore.subscribe, liveStore.getSnapshot)
  useEffect(() => {
    if (!LIVE) return
    const handler = (e: BeforeUnloadEvent) => {
      if (liveStore.getSnapshot().dirty || liveStore.getSnapshot().saving) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])
  return {
    ...state,
    setArts: (value: SetStateAction<Article[]>) => liveStore.update('arts', value),
    setCols: (value: SetStateAction<Collection[]>) => liveStore.update('cols', value),
    setDims: (value: SetStateAction<DimDef[]>) =>
      liveStore.update('dims', (dims) => (typeof value === 'function' ? value(dims ?? []) : value)),
    setTags: (value: SetStateAction<Tag[]>) =>
      liveStore.update('tags', (tags: LiveTag[]) =>
        (typeof value === 'function' ? value(tags) : value).map((t) => {
          if (t.ref) return t as LiveTag
          const id = operationKey()
          return {
            ...t,
            ref: `draft/${id}`,
            field: fields.includes(t.dim as (typeof fields)[number]) ? t.dim : 'custom',
            term: id,
          }
        }),
      ),
  }
}
