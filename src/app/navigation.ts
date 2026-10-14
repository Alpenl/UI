import { useNavigate, useSearch } from '@tanstack/react-router'
import type { Dispatch, SetStateAction } from 'react'
import { z } from 'zod'
const filterSchema = z.object({
  q: z.string().catch(''),
  quick: z.enum(['all', 'todo']).catch('all'),
  fCol: z.string().nullable().catch(null),
  tagScopes: z.record(z.string(), z.enum(['exact', 'with_narrower'])).catch({}),
  fTags: z.array(z.string()).catch([]),
  sel: z.number().int().positive().nullable().catch(null),
  range: z
    .string()
    .regex(/^(all|1|3|7|30|d\d+)$/)
    .catch('all'),
})
const emptyFilter = filterSchema.parse({})
export const navigationSchema = z.object({
  matchMode: z.enum(['any', 'all']).catch('any'),
  collectionKind: z.enum(['article', 'site']).catch('article'),
  view: z.enum(['lib', 'set']).catch('lib'),
  kind: z.enum(['article', 'site']).catch('article'),
  tab: z.enum(['status', 'col', 'tag']).catch('status'),
  filters: z
    .object({ article: filterSchema.catch(emptyFilter), site: filterSchema.catch(emptyFilter) })
    .catch({ article: emptyFilter, site: emptyFilter }),
})
export type Navigation = z.infer<typeof navigationSchema>
export function useRouteField<K extends keyof Navigation>(
  key: K,
): [Navigation[K], Dispatch<SetStateAction<Navigation[K]>>] {
  const state = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  return [
    state[key],
    (next) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          [key]:
            typeof next === 'function'
              ? (next as (value: Navigation[K]) => Navigation[K])(navigationSchema.parse(previous)[key])
              : next,
        }),
      })
    },
  ]
}
