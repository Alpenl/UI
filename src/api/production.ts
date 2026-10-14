import { MemoryCache } from './memory-cache'
import { z } from 'zod'
import type { Article, Collection, Tag, DimDef } from '@/domain/library'
import { DIM_PALETTE } from '@/domain/library'
import { articlesSchema } from '@/domain/schemas'
import { t } from '@/i18n'
import { DESIGN, GO_BACKEND, apiPath } from './production-mode'
import { csrfToken } from './session'

export { LIVE } from './production-mode'
const text = z.string().catch('')
const basisShape = {
  ai_label: z.string().optional(),
  input_version: z.number().optional(),
  review: z.object({ unknown: z.number(), needs_review: z.number() }).optional(),
}
const term = z.object({
  ...basisShape,
  id: z.string(),
  label: z.string(),
  active: z.boolean().default(true),
  ai_enabled: z.boolean().optional(),
  aliases: z.array(z.string()).default([]),
  description: text,
})
const catalogSchema = z.object({
  classification_version: z.number().optional(),
  structure_editable: z.boolean().optional(),
  classification_runs: z.boolean().optional(),
  relations_version: z.number().optional(),
  parents: z.record(z.string(), z.string()).optional(),
  revision: z.number(),
  catalog: z.record(z.string(), z.unknown()),
  dimensions: z
    .array(
      z.object({
        ...basisShape,
        id: z.string(),
        label: z.string(),
        description: text,
        color: z.number(),
        ai_enabled: z.number(),
        archived: z.number(),
        revision: z.number(),
      }),
    )
    .default([]),
  custom_tags: z
    .array(
      z.object({
        ...basisShape,
        id: z.string(),
        label: z.string(),
        tag_ref: z.string(),
        revision: z.number(),
        status: z.string().default('active'),
        dimension_id: z.string().nullable().optional(),
        description: text,
        aliases: z.union([z.string(), z.array(z.string())]).optional(),
        ai_enabled: z.union([z.boolean(), z.number()]).optional(),
      }),
    )
    .default([]),
})
const collectionSchema = z.object({
  id: z.string(),
  kind: z.enum(['article', 'site']).default('article'),
  name: z.string(),
  description: text,
  revision: z.number(),
  pinned: z.number(),
  archived: z.number(),
  deleted: z.number(),
  item_count: z.number().default(0),
  range_count: z.number().default(0),
  rule_tag_modes: z.record(z.string(), z.enum(['exact', 'with_narrower'])).optional(),
  rule_exclude_modes: z.record(z.string(), z.enum(['exact', 'with_narrower'])).optional(),
  rule_tags: text,
  rule_mode: text,
  rule_enabled: z.number().default(0),
  rule_exclude_tags: text,
  rule_admission: text,
  rule_confirmed_only: z.number().default(0),
})
const tagStateSchema = z.object({
  revision: z.number(),
  content_revision: z.number(),
  decision_id: z.number().nullable(),
  selection: z.record(z.string(), z.unknown()),
  custom_tags: z.array(z.object({ tag_ref: z.string() })).default([]),
  state: z
    .object({
      fields: z.record(
        z.string(),
        z.object({ actions: z.array(z.object({ action: z.string(), term: z.string().optional() })).default([]) }),
      ),
    })
    .optional(),
})
export type TagState = z.infer<typeof tagStateSchema>
export class BackendError extends Error {
  constructor(
    public status: number,
    public code = 'backend_error',
  ) {
    super(code)
  }
}
const operationJournal = new Map<string, string>()
export const clearOperationJournal = () => operationJournal.clear()
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method?: 'POST' | 'PATCH' | 'DELETE',
  signal?: AbortSignal,
): Promise<T> {
  if (DESIGN) {
    signal?.throwIfAborted()
    if (body !== undefined || method !== undefined) throw new BackendError(409, 'design_read_only')
    const { readDesign } = await import('@/design/adapter')
    signal?.throwIfAborted()
    return schema.parse(readDesign(path))
  }
  if (body && typeof body === 'object' && 'operation_key' in body) {
    const intent = { ...body, operation_key: undefined }
    const signature = JSON.stringify([path, method, intent])
    const key = operationJournal.get(signature) ?? String(body.operation_key)
    operationJournal.set(signature, key)
    body = { ...body, operation_key: key }
  }
  const response = await fetch(apiPath(path), {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin',
    priority: 'high',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Cairn-Tag-System': '1',
      'X-Cairn-Topic-Granularity': '1',
      'X-Cairn-Collections': '2',
      ...(GO_BACKEND ? { 'X-CSRF-Token': csrfToken() } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
    if (GO_BACKEND && response.status === 401) window.dispatchEvent(new Event('cairn:session-expired'))
    throw new BackendError(response.status, GO_BACKEND ? error.code : error.error)
  }
  const payload: unknown = await response.json()
  if (GO_BACKEND) return schema.parse(z.object({ code: z.literal('OK'), data: z.unknown() }).parse(payload).data)
  return schema.parse(payload)
}
// Works on trusted LAN HTTP, where crypto.randomUUID is unavailable.
export function operationKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export const fields = [
  'topics',
  'resource_kinds',
  'content_functions',
  'carriers',
  'affordances',
  'forms',
  'uses',
] as const
const catalogField = (field: string) => ({ form: 'forms', use: 'uses' })[field] ?? field
const selectionField = (field: string) => ({ forms: 'form', uses: 'use' })[field] ?? field
export type LiveTag = Tag & { ref: string; field: string; term: string; revision?: number; sourceLabel?: string }
export type Snapshot = {
  structureEditable?: boolean
  classificationRuns?: boolean
  relationsVersion?: number
  parents?: Record<string, string>
  classificationVersion?: number
  dims?: DimDef[]
  arts: Article[]
  cols: Collection[]
  tags: LiveTag[]
  tagStates: Record<number, TagState>
  collectionRevisions: Record<string, number>
  catalogRevision: number
  server?: ServerView
}
export type WorkspaceQuery = {
  q?: string
  quick?: string
  range?: string
  today?: string
  tag_modes?: Record<string, 'exact' | 'with_narrower'>
  tags?: string[]
  mode?: string
  collection?: string
  kind?: string
  cursor?: number
}
export function normalizeWorkspaceQuery(query: WorkspaceQuery): WorkspaceQuery {
  const tags = [...new Set(query.tags ?? [])].sort()
  return {
    q: query.q?.trim() || '',
    quick: query.quick ?? 'all',
    range: query.range ?? 'all',
    tags,
    ...(query.tag_modes
      ? { tag_modes: Object.fromEntries(tags.map((ref) => [ref, query.tag_modes?.[ref] ?? 'exact'])) }
      : {}),
    mode: tags.length > 1 ? (query.mode ?? 'any') : 'any',
    collection: query.collection || undefined,
    kind: query.kind ?? 'article',
    today: query.today,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  }
}
export const workspaceQueryKey = (query: WorkspaceQuery) => JSON.stringify(normalizeWorkspaceQuery(query))
const overviewSchema = z.object({
  saved: z.number(),
  tags: z.number(),
  placed: z.number(),
  latest_id: z.number().nullable(),
  days: z.array(z.object({ day: z.string(), n: z.number() })),
  events: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      date: z.string(),
      type: z.string(),
      collection: z.string().nullable(),
      count: z.number(),
    }),
  ),
  failed: articlesSchema,
})
const viewSchema = z.object({
  match_reasons: z.record(z.string(), z.array(z.object({ requested_ref: z.string(), via_ref: z.string() }))).optional(),
  revision: z.number().optional(),
  reconciling: z.boolean().optional(),
  tag_rollups: z
    .record(z.string(), z.object({ direct: z.number(), total: z.number(), via_narrower: z.number() }))
    .optional(),
  total: z.number(),
  next_cursor: z.number().nullable(),
  facets: z.object({ total: z.number(), failed: z.number(), tags: z.record(z.string(), z.number()) }),
  overview: overviewSchema,
})
export type ServerView = z.infer<typeof viewSchema>
const workspaceSchema = viewSchema.extend({
  version: z.literal(1),
  catalog: catalogSchema,
  collections: z.array(collectionSchema),
  items: articlesSchema,
})
export function mapCatalog(catalog: z.infer<typeof catalogSchema>) {
  const tags: LiveTag[] = fields.flatMap((field) =>
    z
      .array(term)
      .parse(catalog.catalog[field] ?? [])
      .map((item) => ({
        name: item.label,
        aiLabel: item.ai_label,
        inputVersion: item.input_version,
        review: item.review,
        sourceLabel: item.label,
        dim: field,
        auto: item.ai_enabled ?? true,
        enabled: item.active,
        aliases: item.aliases.join(', '),
        desc: item.description,
        ref: `system/${selectionField(field)}/${item.id}`,
        field,
        term: item.id,
      })),
  )
  tags.push(
    ...catalog.custom_tags.map((item) => ({
      name: item.label,
      aiLabel: item.ai_label,
      inputVersion: item.input_version,
      review: item.review,
      sourceLabel: item.label,
      dim: item.dimension_id ?? 'custom',
      auto: !!item.ai_enabled,
      enabled: item.status === 'active',
      aliases: (typeof item.aliases === 'string'
        ? z.array(z.string()).parse(JSON.parse(item.aliases))
        : (item.aliases ?? [])
      ).join(', '),
      desc: item.description,
      revision: item.revision,
      user: true,
      ref: item.tag_ref,
      field: 'custom',
      term: item.id,
    })),
  )
  // The view's name identity must never silently merge distinct server tags.
  const counts = new Map<string, number>()
  tags.forEach((x) => counts.set(x.name, (counts.get(x.name) ?? 0) + 1))
  tags.forEach((x) => {
    if ((counts.get(x.name) ?? 0) > 1) {
      const dimension = catalog.dimensions.find((d) => d.id === x.dim) ?? liveDimensions().find((d) => d.id === x.dim)
      x.name = `${x.name} · ${dimension?.label ?? x.dim}`
    }
  })
  // Renamed dimensions can themselves share a name. Stable refs disambiguate
  // that rare case without allowing two independent tags to share UI identity.
  const decorated = new Map<string, number>()
  tags.forEach((x) => decorated.set(x.name, (decorated.get(x.name) ?? 0) + 1))
  tags.forEach((x) => {
    if ((decorated.get(x.name) ?? 0) > 1) x.name = `${x.name} · ${x.ref}`
  })
  return {
    structureEditable: catalog.structure_editable,
    classificationRuns: catalog.classification_runs,
    relationsVersion: catalog.relations_version,
    parents: catalog.parents,
    classificationVersion: catalog.classification_version,
    dims: [
      ...liveDimensions().filter((d) => !catalog.dimensions.some((x) => x.id === d.id)),
      ...catalog.dimensions.map((d) => ({
        id: d.id,
        label: d.label,
        chip: DIM_PALETTE[d.color],
        auto: !!d.ai_enabled,
        archived: !!d.archived,
        revision: d.revision,
        description: d.description,
        aiLabel: d.ai_label,
      })),
    ],
    tags,
  }
}
export async function loadSnapshot(query: WorkspaceQuery = {}, signal?: AbortSignal): Promise<Snapshot> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '')
      params.set(key, key === 'tags' || key === 'tag_modes' ? JSON.stringify(value) : String(value))
  const payload = await request('/api/workspace?' + params, workspaceSchema, undefined, undefined, signal)
  const catalog = payload.catalog
  const { tags, dims, classificationVersion } = mapCatalog(catalog)
  const nameOf = (ref: string) => tags.find((x) => x.ref === ref)?.name ?? ref
  const cols: Collection[] = payload.collections.map((c) => ({
    ruleTagModes: c.rule_tag_modes,
    ruleExcludeModes: c.rule_exclude_modes,
    id: c.id,
    kind: c.kind,
    name: c.name,
    purpose: c.description,
    pinned: !!c.pinned,
    archived: !!c.archived,
    deleted: !!c.deleted,
    ruleEnabled: !!c.rule_enabled,
    exclude: z
      .array(z.string())
      .parse(JSON.parse(c.rule_exclude_tags || '[]'))
      .map(nameOf),
    admission: c.rule_admission === 'review' ? 'review' : 'direct',
    confirmedOnly: !!c.rule_confirmed_only,
    mode: c.rule_mode === 'all' ? 'all' : 'any',
    rule: z
      .array(z.string())
      .parse(JSON.parse(c.rule_tags || '[]'))
      .map(nameOf),
    count: c.item_count,
    rangeCount: c.range_count,
  }))
  const mapArticle = (a: Article) => ({ ...a, tags: a.tags.map(nameOf), excluded: a.excluded.map(nameOf) })
  const arts = payload.items.map(mapArticle)
  const server = {
    ...viewSchema.parse(payload),
    overview: { ...payload.overview, failed: payload.overview.failed.map(mapArticle) },
  }
  return {
    dims,
    structureEditable: catalog.structure_editable,
    classificationRuns: catalog.classification_runs,
    relationsVersion: catalog.relations_version,
    parents: catalog.parents,
    classificationVersion,
    arts,
    cols,
    tags,
    tagStates: {},
    server,
    collectionRevisions: Object.fromEntries(payload.collections.map((c) => [c.id, c.revision])),
    catalogRevision: catalog.revision,
  }
}
const detailSchema = z.object({
  article: articlesSchema.element,
  tag_state: tagStateSchema,
  body_unchanged: z.boolean().default(false),
})
type Detail = z.infer<typeof detailSchema>
const readingCache = new MemoryCache<number, Detail>(8, 8 * 1024 * 1024, 300_000)
export const clearReadingCache = () => readingCache.clear()
export const cachedArticle = (id: number, summary?: Article) => {
  const value = readingCache.get(id, 60_000)
  if (!value || summary?.bodyRevision === undefined || summary.personalRevision === undefined) return undefined
  return value.article.bodyRevision === summary.bodyRevision &&
    value.article.personalRevision === summary.personalRevision
    ? value
    : undefined
}
export function mapDetail(value: Detail, tags: LiveTag[]) {
  const names = new Map(tags.map((t) => [t.ref, t.name]))
  const nameOf = (ref: string) => names.get(ref) ?? ref
  return {
    article: {
      ...value.article,
      tags: value.article.tags.map(nameOf),
      excluded: GO_BACKEND
        ? value.article.excluded.map(nameOf)
        : Object.entries(value.tag_state.state?.fields ?? {}).flatMap(([field, data]) =>
            data.actions.filter((a) => a.action === 'reject' && a.term).map((a) => nameOf(`system/${field}/${a.term}`)),
          ),
    },
    state: value.tag_state,
  }
}
export async function loadArticle(id: number, tags: LiveTag[], signal?: AbortSignal) {
  const cached = readingCache.get(id)
  try {
    const value = await request(
      `/api/workspace/${id}${cached?.article.bodyRevision !== undefined ? `?body_revision=${cached.article.bodyRevision}` : ''}`,
      detailSchema,
      undefined,
      undefined,
      signal,
    )
    signal?.throwIfAborted()
    if (value.body_unchanged) {
      if (!cached || value.article.bodyRevision !== cached.article.bodyRevision)
        throw new Error('invalid_body_revision')
      value.article.body = cached.article.body
      value.article.raw = cached.article.raw
    }
    readingCache.set(id, value)
    return mapDetail(value, tags)
  } catch (error) {
    if (error instanceof BackendError && [401, 403, 404].includes(error.status)) readingCache.delete(id)
    throw error
  }
}
export async function loadMembers(id: string, tags: Tag[], cursor?: number, signal?: AbortSignal) {
  const value = await request(
    `/api/workspace/collections/${id}${cursor ? `?cursor=${cursor}` : ''}`,
    z.object({
      revision: z.number(),
      items: articlesSchema,
      next_cursor: z.number().nullable(),
      next_id: z.number().nullable(),
    }),
    undefined,
    undefined,
    signal,
  )
  return {
    ...value,
    items: value.items.map((a) => ({ ...a, tags: a.tags.map((ref) => tags.find((t) => t.ref === ref)?.name ?? ref) })),
  }
}
export const liveDimensions = (): DimDef[] =>
  ([...fields, 'custom'] as const).map((id, i) => ({
    id,
    label: t(`common:backendDimension_${id}`),
    chip: DIM_PALETTE[i % DIM_PALETTE.length],
  }))
const catalogRevisionSchema = z.object({ revision: z.number() }).optional()
const responseSchema = z.object({
  revision: z.number(),
  operation_revision: z.number().optional(),
  catalog: catalogRevisionSchema,
})
export async function saveChanges(before: Snapshot, after: Snapshot) {
  const deletedRefs = new Set(after.tags.filter((t) => t.deleteRequested).map((t) => t.ref))
  const revisions = { ...before.collectionRevisions }
  let catalogRevision = before.catalogRevision
  const acceptCatalogRevision = (catalog?: { revision: number }) => {
    if (!catalog) return
    if (catalog.revision !== catalogRevision + 1) throw new BackendError(409, 'revision_conflict')
    catalogRevision = catalog.revision
  }
  const refs = new Map(after.tags.filter((t) => t.ref).map((t) => [t.name, t.ref]))
  const ref = (name: string) => {
    const value = refs.get(name) ?? before.tags.find((t) => t.name === name)?.ref
    if (!value) throw new Error('unsupported')
    return value
  }
  const collectionOp = async (id: string, type: string, data: object = {}) => {
    const result = await request(`/api/collections/${encodeURIComponent(id)}/operations`, responseSchema, {
      operation_key: operationKey(),
      expected_revision: revisions[id] ?? 0,
      type,
      ...data,
    })
    revisions[id] = result.revision
  }
  if (!GO_BACKEND && (after.arts.some((a) => a.kind !== 'article') || after.cols.some((c) => c.kind !== 'article')))
    throw new Error('unsupported')
  // Validate the whole draft before the first remote operation.
  for (const tag of after.tags) {
    if (tag.deleteRequested) continue
    if (JSON.stringify(tag) === JSON.stringify(before.tags.find((t) => t.ref === tag.ref))) continue
    if (!tag.name.trim() || (tag.auto && !tag.desc.trim())) throw new BackendError(400, 'invalid_tag_definition')
    const old = before.tags.find((t) => t.ref === tag.ref)
    if (old && old.field !== 'custom' && old.dim !== tag.dim) throw new BackendError(400, 'system_dimension_fixed')
  }
  if (GO_BACKEND && before.classificationVersion === 1) {
    for (const tag of after.tags) {
      const old = before.tags.find((t) => t.ref === tag.ref)
      if (
        old &&
        !tag.deleteRequested &&
        (tag.desc !== old.desc || tag.aiLabel !== old.aiLabel || tag.dim !== old.dim) &&
        (!tag.changeClass || (tag.dim !== old.dim && tag.changeClass !== 'redefined'))
      )
        throw new BackendError(400, 'classification_change_required')
    }
    for (const dim of after.dims ?? []) {
      const old = before.dims?.find((d) => d.id === dim.id)
      if (old && (dim.aiLabel !== old.aiLabel || dim.description !== old.description) && !dim.changeClass)
        throw new BackendError(400, 'classification_change_required')
    }
  }
  // The legacy NAS still requires an AI tag per built-in field. Go permits
  // empty types and skips them during classification.
  for (const field of GO_BACKEND ? [] : fields) {
    const existing = before.tags.filter((t) => t.field === field)
    if (
      existing.length &&
      after.tags.some(
        (t) => t.field === field && JSON.stringify(t) !== JSON.stringify(before.tags.find((x) => x.ref === t.ref)),
      ) &&
      !after.tags.some((t) => t.field === field && t.enabled && t.auto && !t.deleteRequested)
    )
      throw new BackendError(409, 'last_ai_tag')
  }
  for (const c of after.cols) if (!c.name.trim()) throw new BackendError(400, 'invalid_name')
  for (const d of after.dims ?? []) {
    const old = before.dims?.find((x) => x.id === d.id)
    if (JSON.stringify(old) === JSON.stringify(d)) continue
    let revision = old?.revision ?? 0
    if (
      !old ||
      d.label !== old.label ||
      d.chip !== old.chip ||
      d.auto !== old.auto ||
      d.description !== old.description ||
      d.aiLabel !== old.aiLabel
    ) {
      const result = await request('/api/tag-catalog/operations', responseSchema, {
        operation_key: operationKey(),
        id: d.id,
        expected_revision: revision,
        type: old?.revision ? 'dimension_edit' : 'dimension_create',
        definition: {
          label: d.label,
          description: d.description ?? '',
          ...(GO_BACKEND && before.classificationVersion === 1
            ? { ai_label: d.aiLabel, change_class: d.changeClass }
            : {}),
          color: DIM_PALETTE.indexOf(d.chip),
          ai_enabled: d.auto ?? true,
        },
      })
      revision = result.revision
      acceptCatalogRevision(result.catalog)
    }
    if (!!d.archived !== !!old?.archived) {
      const result = await request('/api/tag-catalog/operations', responseSchema, {
        operation_key: operationKey(),
        id: d.id,
        expected_revision: revision,
        type: d.archived ? 'dimension_archive' : 'dimension_restore',
      })
      acceptCatalogRevision(result.catalog)
    }
  }
  for (const tag of after.tags) {
    const old = before.tags.find((x) => x.ref === tag.ref)
    if (tag.deleteRequested || JSON.stringify(tag) === JSON.stringify(old)) continue
    const aliases = tag.aliases
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean)
    const custom = old ? old.field === 'custom' : !fields.includes(tag.dim as (typeof fields)[number])
    const label = tag.displayLabel ?? (old && tag.name === old.name ? (old.sourceLabel ?? tag.name) : tag.name)
    const basis =
      GO_BACKEND && before.classificationVersion === 1 ? { ai_label: tag.aiLabel, change_class: tag.changeClass } : {}
    if (custom) {
      const result = await request(
        old ? `/api/custom-tags/${old.term}` : '/api/custom-tags',
        z.object({ tag: z.object({ tag_ref: z.string(), revision: z.number() }), catalog: catalogRevisionSchema }),
        {
          operation_key: operationKey(),
          ...(old ? { expected_revision: old.revision, archived: !tag.enabled } : {}),
          label,
          description: tag.desc,
          ...basis,
          aliases,
          ai_enabled: tag.auto,
          dimension_id: tag.dim === 'custom' ? null : tag.dim,
        },
        old ? 'PATCH' : 'POST',
      )
      acceptCatalogRevision(result.catalog)
      refs.set(tag.name, result.tag.tag_ref)
      if (!old && !tag.enabled) {
        const archived = await request(
          `/api/custom-tags/${result.tag.tag_ref.split('/').at(-1)}`,
          z.object({ catalog: catalogRevisionSchema }),
          { operation_key: operationKey(), expected_revision: result.tag.revision, label: tag.name, archived: true },
          'PATCH',
        )
        acceptCatalogRevision(archived.catalog)
      }
    } else {
      const definition = { label, aliases, description: tag.desc, ai_enabled: tag.auto, ...basis }
      if (
        !old ||
        tag.name !== old.name ||
        tag.aliases !== old.aliases ||
        tag.desc !== old.desc ||
        tag.auto !== old.auto ||
        tag.aiLabel !== old.aiLabel ||
        tag.displayLabel !== old.displayLabel
      ) {
        const result = await request(
          '/api/tag-catalog/operations',
          z.object({ revision: z.number(), id: z.string(), operation_revision: z.number().optional() }),
          {
            operation_key: operationKey(),
            expected_revision: catalogRevision,
            dimension: tag.dim,
            ...(old ? { id: old.term } : {}),
            type: old ? 'edit' : 'create',
            definition,
          },
        )
        catalogRevision = result.operation_revision ?? result.revision
        refs.set(tag.name, `system/${selectionField(tag.dim)}/${result.id}`)
      }
      if (old ? tag.enabled !== old.enabled : !tag.enabled) {
        const result = await request('/api/tag-catalog/operations', responseSchema, {
          operation_key: operationKey(),
          expected_revision: catalogRevision,
          dimension: old?.field ? catalogField(old.field) : tag.dim,
          id: old?.term ?? refs.get(tag.name)!.split('/').at(-1),
          type: tag.enabled ? 'restore' : 'archive',
        })
        catalogRevision = result.operation_revision ?? result.revision
      }
    }
  }
  for (const c of after.cols) {
    const old = before.cols.find((x) => x.id === c.id)
    if (!old)
      await collectionOp(c.id, 'create', {
        name: c.name,
        description: c.purpose,
        ...(GO_BACKEND ? { kind: c.kind } : {}),
      })
    if (old && !!old.deleted !== !!c.deleted) await collectionOp(c.id, c.deleted ? 'delete' : 'restore')
    if (c.deleted) continue
    if (
      old &&
      (old.name !== c.name || old.purpose !== c.purpose || old.pinned !== c.pinned || old.archived !== c.archived)
    )
      await collectionOp(c.id, 'edit', { name: c.name, description: c.purpose, pinned: c.pinned, archived: c.archived })
    const rule = (x: Collection) => ({
      enabled: x.ruleEnabled ?? x.rule.length > 0,
      mode: x.mode,
      tag_refs: x.rule.map(ref),
      exclude_tag_refs: (x.exclude ?? []).map(ref),
      admission: x.admission ?? 'direct',
      confirmed_only: x.confirmedOnly ?? false,
    })
    const cleanedByDeletion = old && [...old.rule, ...(old.exclude ?? [])].some((name) => deletedRefs.has(ref(name)))
    const priorRule =
      old &&
      rule(
        cleanedByDeletion
          ? {
              ...old,
              rule: old.rule.filter((name) => !deletedRefs.has(ref(name))),
              exclude: (old.exclude ?? []).filter((name) => !deletedRefs.has(ref(name))),
              ruleEnabled: false,
            }
          : old,
      )
    if ((!old && c.rule.length) || (old && JSON.stringify(priorRule) !== JSON.stringify(rule(c))))
      await collectionOp(c.id, 'rule', rule(c))
    if (c.backfill) await collectionOp(c.id, 'backfill')
  }
  for (const a of after.arts) {
    const old = before.arts.find((x) => x.id === a.id)
    if (!old) throw new Error('unsupported')
    const previous = old.tags.map((name) => before.tags.find((t) => t.name === name)?.ref ?? name),
      next = a.tags.map(ref)
    const actions = [
      ...next
        .filter((x) => !previous.includes(x))
        .map((tag_ref) => ({ action: tag_ref.startsWith('system/') ? 'accept' : 'attach', tag_ref })),
      ...previous
        .filter((x) => !next.includes(x) && !deletedRefs.has(x))
        .map((tag_ref) => ({ action: tag_ref.startsWith('system/') ? 'reject' : 'detach', tag_ref })),
    ]
    let state = before.tagStates[a.id]
    if (actions.length && !state) {
      const loaded = await loadArticle(a.id, before.tags)
      if (old.personalRevision !== undefined && loaded.state.revision !== old.personalRevision)
        throw new BackendError(409, 'revision_conflict')
      state = loaded.state
    }
    for (let i = 0; i < actions.length; i += 20)
      state = await request(`/api/bookmarks/${a.id}/tags`, tagStateSchema, {
        operation_key: operationKey(),
        expected_revision: state.revision,
        expected_content_revision: state.content_revision,
        expected_decision_id: state.decision_id,
        actions: actions.slice(i, i + 20),
      })
    for (const c of after.cols.filter((c) => !c.deleted)) {
      const was = c.id in old.cols,
        now = c.id in a.cols
      if (was !== now) await collectionOp(c.id, now ? 'add' : 'remove', { link_ids: [a.id] })
      if (now && a.cols[c.id] !== (old.cols[c.id] ?? ''))
        await collectionOp(c.id, 'note', { link_id: a.id, note: a.cols[c.id] })
    }
  }
  for (const tag of after.tags.filter((t) => t.deleteRequested)) {
    const old = before.tags.find((t) => t.ref === tag.ref)
    if (!old) continue
    if (old.field === 'custom')
      await request(
        `/api/custom-tags/${old.term}`,
        z.unknown(),
        { operation_key: operationKey(), expected_revision: old.revision, detach_all: true, permanent: true },
        'DELETE',
      )
    else {
      const result = await request('/api/tag-catalog/operations', responseSchema, {
        operation_key: operationKey(),
        expected_revision: catalogRevision,
        dimension: catalogField(old.field!),
        id: old.term,
        type: 'delete',
      })
      catalogRevision = result.operation_revision ?? result.revision
    }
  }
  for (const c of before.cols) if (!after.cols.some((x) => x.id === c.id)) await collectionOp(c.id, 'delete')
}

export async function collectionAction(id: string, revision: number, type: string, data: object = {}) {
  return request(`/api/collections/${encodeURIComponent(id)}/operations`, responseSchema, {
    operation_key: operationKey(),
    expected_revision: revision,
    type,
    ...data,
  })
}

export type DeletionIntent = { kind: 'tag' | 'dimension'; id: string }
const deletionSchema = z.object({
  tag_refs: z.array(z.string()),
  dimension_id: z.string().optional(),
  catalog_revision: z.number(),
  article_revisions: z.record(z.string(), z.number()),
  collection_revisions: z.record(z.string(), z.number()),
})
export type DeletionReceipt = z.infer<typeof deletionSchema>
export async function deleteCatalogItem(before: Snapshot, intent: DeletionIntent) {
  const schema = z.object({ deletion: deletionSchema.nullish() })
  if (intent.kind === 'dimension') {
    const dim = before.dims?.find((d) => d.id === intent.id)
    if (!dim || fields.includes(dim.id as (typeof fields)[number]) || dim.id === 'custom')
      throw new BackendError(409, 'system_dimension_fixed')
    if (!dim.revision) throw new BackendError(409, 'revision_conflict')
    return (
      await request('/api/tag-catalog/operations', schema, {
        operation_key: operationKey(),
        type: 'dimension_delete',
        id: dim.id,
        expected_revision: dim.revision,
        detach_all: true,
      })
    ).deletion
  }
  const tag = before.tags.find((t) => t.ref === intent.id)
  if (!tag) throw new BackendError(404, 'tag_not_found')
  if (tag.field === 'custom')
    return (
      await request(
        `/api/custom-tags/${tag.term}`,
        schema,
        {
          operation_key: operationKey(),
          expected_revision: tag.revision,
          detach_all: true,
          permanent: true,
        },
        'DELETE',
      )
    ).deletion
  return (
    await request('/api/tag-catalog/operations', schema, {
      operation_key: operationKey(),
      expected_revision: before.catalogRevision,
      dimension: catalogField(tag.field),
      id: tag.term,
      type: 'delete',
    })
  ).deletion
}
// Only apply the server's committed identities and revisions. Aggregate counts
// remain server-owned and are revalidated in the background.
export function applyDeletion(before: Snapshot, receipt: DeletionReceipt): Snapshot {
  const refs = new Set(receipt.tag_refs)
  const names = new Set(before.tags.filter((t) => refs.has(t.ref)).map((t) => t.name))
  const keep = (values: string[]) => values.filter((name) => !names.has(name))
  const keepModes = (modes: Collection['ruleTagModes']) =>
    modes && Object.fromEntries(Object.entries(modes).filter(([ref]) => !refs.has(ref)))
  return {
    ...before,
    catalogRevision: receipt.catalog_revision,
    dims: before.dims?.filter((d) => d.id !== receipt.dimension_id),
    tags: before.tags.filter((t) => !refs.has(t.ref)),
    parents: Object.fromEntries(
      Object.entries(before.parents ?? {}).filter(([child, parent]) => !refs.has(child) && !refs.has(parent)),
    ),
    arts: before.arts.map((a) => ({
      ...a,
      tags: keep(a.tags),
      excluded: keep(a.excluded),
      personalRevision: receipt.article_revisions[a.id] ?? a.personalRevision,
    })),
    // TagState contains nested classifier evidence; invalidate affected states
    // instead of inventing a partially updated version of that server contract.
    tagStates: Object.fromEntries(
      Object.entries(before.tagStates).filter(([id]) => !(id in receipt.article_revisions)),
    ),
    cols: before.cols.map((c) =>
      c.id in receipt.collection_revisions
        ? {
            ...c,
            rule: keep(c.rule),
            exclude: keep(c.exclude ?? []),
            ruleEnabled: false,
            ruleTagModes: keepModes(c.ruleTagModes),
            ruleExcludeModes: keepModes(c.ruleExcludeModes),
          }
        : c,
    ),
    collectionRevisions: { ...before.collectionRevisions, ...receipt.collection_revisions },
  }
}

// Only a single existing metadata edit qualifies. Mixed drafts keep the existing
// batch/recovery flow; no client-predicted revision becomes authoritative.
export async function saveSingleCatalogEdit(before: Snapshot, after: Snapshot): Promise<Snapshot | null> {
  if (!GO_BACKEND || before.classificationVersion !== 1) return null
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  if (before.tags.length !== after.tags.length || before.dims?.length !== after.dims?.length) return null
  const changedTags = after.tags.filter(
    (t) =>
      !same(
        t,
        before.tags.find((x) => x.ref === t.ref),
      ),
  )
  const changedDims = (after.dims ?? []).filter(
    (d) =>
      !same(
        d,
        before.dims?.find((x) => x.id === d.id),
      ),
  )
  if (changedTags.length + changedDims.length !== 1) return null
  const canonical = (s: Snapshot) => {
    const ref = (name: string) => s.tags.find((t) => t.name === name)?.ref ?? name
    return {
      arts: s.arts.map((a) => ({ ...a, tags: a.tags.map(ref), excluded: a.excluded.map(ref) })),
      cols: s.cols.map((c) => ({ ...c, rule: c.rule.map(ref), exclude: c.exclude?.map(ref) })),
    }
  }
  if (!same(canonical(before), canonical(after))) return null
  const schema = z.object({ catalog: catalogSchema })
  let catalog: z.infer<typeof catalogSchema>
  if (changedTags.length) {
    const tag = changedTags[0],
      old = before.tags.find((x) => x.ref === tag.ref)
    if (!old || tag.deleteRequested || tag.enabled !== old.enabled || tag.dim !== old.dim) return null
    const label = tag.displayLabel ?? (tag.name === old.name ? (old.sourceLabel ?? tag.name) : tag.name)
    if (!label.trim() || (tag.auto && !tag.desc.trim())) throw new BackendError(400, 'invalid_tag_definition')
    if ((tag.aiLabel !== old.aiLabel || tag.desc !== old.desc) && !tag.changeClass)
      throw new BackendError(400, 'classification_change_required')
    const definition = {
      label,
      description: tag.desc,
      aliases: tag.aliases
        .split(/[,，]/)
        .map((x) => x.trim())
        .filter(Boolean),
      ai_enabled: tag.auto,
      ai_label: tag.aiLabel,
      change_class: tag.changeClass,
    }
    catalog =
      old.field === 'custom'
        ? (
            await request(
              `/api/custom-tags/${old.term}`,
              schema,
              { operation_key: operationKey(), expected_revision: old.revision, ...definition },
              'PATCH',
            )
          ).catalog
        : (
            await request('/api/tag-catalog/operations', schema, {
              operation_key: operationKey(),
              expected_revision: before.catalogRevision,
              type: 'edit',
              dimension: old.dim,
              id: old.term,
              definition,
            })
          ).catalog
  } else {
    const dim = changedDims[0],
      old = before.dims?.find((d) => d.id === dim.id)
    if (!old?.revision || dim.archived !== old.archived) return null
    if ((dim.aiLabel !== old.aiLabel || dim.description !== old.description) && !dim.changeClass)
      throw new BackendError(400, 'classification_change_required')
    catalog = (
      await request('/api/tag-catalog/operations', schema, {
        operation_key: operationKey(),
        expected_revision: old.revision,
        type: 'dimension_edit',
        id: dim.id,
        definition: {
          label: dim.label,
          description: dim.description ?? '',
          color: DIM_PALETTE.indexOf(dim.chip),
          ai_enabled: dim.auto ?? true,
          ai_label: dim.aiLabel,
          change_class: dim.changeClass,
        },
      })
    ).catalog
  }
  // Full catalog comes from the transaction. If other edits intervened, read the
  // authoritative workspace instead of attaching fresh revisions to stale data.
  if (catalog.revision !== before.catalogRevision + 1) throw new BackendError(409, 'catalog_receipt_changed')
  const mapped = mapCatalog(catalog)
  const name = (value: string) => {
    const ref = after.tags.find((t) => t.name === value)?.ref
    return mapped.tags.find((t) => t.ref === ref)?.name ?? value
  }
  return {
    ...after,
    ...mapped,
    structureEditable: before.structureEditable,
    classificationRuns: before.classificationRuns,
    catalogRevision: catalog.revision,
    arts: after.arts.map((a) => ({ ...a, tags: a.tags.map(name), excluded: a.excluded.map(name) })),
    cols: after.cols.map((c) => ({ ...c, rule: c.rule.map(name), exclude: c.exclude?.map(name) })),
  }
}
