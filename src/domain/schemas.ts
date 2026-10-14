import { z } from 'zod'
const kind = z.enum(['article', 'site'])
export const tagsSchema = z.array(
  z.object({
    name: z.string(),
    dim: z.string(),
    auto: z.boolean(),
    enabled: z.boolean(),
    aliases: z.string(),
    desc: z.string(),
    user: z.boolean().optional(),
  }),
)
export const dimensionsSchema = z.array(z.object({ id: z.string(), label: z.string(), chip: z.string() })).min(1)
export const collectionsSchema = z.array(
  z.object({
    id: z.string(),
    kind,
    name: z.string(),
    purpose: z.string(),
    rule: z.array(z.string()),
    mode: z.enum(['any', 'all']),
    pinned: z.boolean(),
    archived: z.boolean(),
  }),
)
export const articlesSchema = z.array(
  z.object({
    bodyRevision: z.number().optional(),
    images: z.array(z.object({ src: z.string() })).optional(),
    media: z
      .array(
        z.object({
          id: z.string().regex(/^[a-f0-9]{32}$/),
          title: z.string(),
          kind: z.enum(['video', 'audio']),
          content_type: z.string().nullable(),
          size: z.number(),
          status: z.string(),
        }),
      )
      .optional(),
    personalRevision: z.number().optional(),
    id: z.number(),
    kind,
    title: z.string(),
    source: z.string(),
    url: z.string(),
    date: z.iso.date(),
    lang: z.enum(['en-translated', 'zh', 'en', 'unknown']),
    summary: z.string(),
    body: z.array(z.string()),
    raw: z.string(),
    tags: z.array(z.string()),
    excluded: z.array(z.string()),
    cols: z.record(z.string(), z.string()),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
    failed: z.boolean().optional(),
    classificationStatus: z.string().optional(),
    processingStatus: z.string().optional(),
    sourceAvailable: z.boolean().optional(),
    site: z
      .object({
        brand: z.string(),
        status: z.enum(['ok', 'dead']),
        checked: z.iso.datetime({ offset: true }),
        pricing: z.enum(['free', 'freemium', 'paid']),
      })
      .optional(),
  }),
)
export const onlineSchema = z.boolean()
