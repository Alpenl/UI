import type { ServerView } from '@/api/production'
import { type Article, type Collection, type Dim, type Kind, type Range, type Tag } from '@/domain/library'

export type Update = (id: number, f: (a: Article) => Article) => void

export type Hit = { kind: Kind; n: number }

export type LibProps = {
  server?: ServerView
  loading?: boolean
  loadingError?: boolean
  retryLoading?: () => void
  fetching?: boolean
  readingRefreshError?: boolean
  prefetch?: (id: number) => void
  reading?: boolean
  readingError?: boolean
  retryReading?: () => void
  previousPage?: () => void
  nextPage?: () => void
  range: Range
  setRange: (r: Range) => void
  goCol: (id: string) => void
  kind: Kind
  allArts: Article[]
  otherHits: Hit[]
  jump: (k: Kind) => void
  openItem: (id: number, fromId?: number) => void
  backToArticle?: () => void
  quick: 'all' | 'todo'
  setQuick: (v: 'all' | 'todo') => void
  todo: number
  arts: Article[]
  shown: Article[]
  tags: Tag[]
  cols: Collection[]
  q: string
  setQ: (v: string) => void
  sel: number | null
  setSel: (id: number | null) => void
  update: Update
  dimOf: (n: string) => Dim
  heading: string
  filtering: boolean
  clear: () => void
  fTags?: string[]
  toggleTag?: (n: string) => void
}

export const MAX_TAGS = 10
