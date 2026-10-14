import { z } from 'zod'
import { request } from './production'

export type TagScope = 'exact' | 'with_narrower'
export type StructuralChange = {
  kind: 'relation' | 'rule'
  child_ref?: string
  parent_ref?: string
  collection_id?: string
  rule?: {
    expected_revision: number
    enabled: boolean
    mode: 'any' | 'all'
    tag_refs: string[]
    exclude_tag_refs: string[]
    admission: 'direct' | 'review'
    confirmed_only: boolean
  }
  tag_modes?: Record<string, TagScope>
  exclude_modes?: Record<string, TagScope>
}
const impactSchema = z.object({
  preview_token: z.string(),
  revision: z.number(),
  digest: z.string(),
  counts: z.record(z.string(), z.number()),
  items: z.array(
    z.object({ collection_id: z.string(), article_id: z.number(), title: z.string(), reason: z.string() }),
  ),
  has_more: z.boolean(),
})
export type Impact = z.infer<typeof impactSchema>
export const previewStructure = (change: StructuralChange, offset = 0, signal?: AbortSignal) =>
  request('/api/tag-system/preview', impactSchema, { change, offset }, 'POST', signal)
export const commitStructure = (change: StructuralChange, token: string, key: string) =>
  request('/api/tag-system/commit', z.object({ revision: z.number(), reconciling: z.boolean() }), {
    operation_key: key,
    preview_token: token,
    change,
  })
