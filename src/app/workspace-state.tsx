import { type Article, type Range } from '@/domain/library'

export type View = 'lib' | 'set'

export type SetTab = 'status' | 'col' | 'tag'

export type Quick = 'all' | 'todo'

export type KS = {
  tagScopes: Record<string, 'exact' | 'with_narrower'>
  q: string
  quick: Quick
  fCol: string | null
  fTags: string[]
  sel: number | null
  range: Range
}

export const EMPTY: KS = { tagScopes: {}, q: '', quick: 'all', fCol: null, fTags: [], sel: null, range: 'all' }

export const matchQ = (a: Article, k: string) =>
  !k ||
  [a.title, a.summary, a.body.join(' '), a.url, a.links.map((l) => l.url + l.label).join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(k)
