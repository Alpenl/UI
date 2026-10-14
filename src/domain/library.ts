import { DESIGN, DESIGN_DATE, LIVE } from '@/api/production-mode'
import { formatDate, t } from '@/i18n'
export type Kind = 'article' | 'site'
export const KINDS: Record<Kind, { label: string; unit: string; noun: string; icon: string }> = {
  article: {
    get label() {
      return t('domain:articles')
    },
    get unit() {
      return t('domain:articleUnit')
    },
    get noun() {
      return t('domain:articles')
    },
    icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  },
  site: {
    get label() {
      return t('domain:websites')
    },
    get unit() {
      return t('domain:items')
    },
    get noun() {
      return t('domain:websites')
    },
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  },
}

export type Dim = string
export type DimDef = {
  aiLabel?: string
  changeClass?: 'wording' | 'broader' | 'narrower' | 'redefined'

  id: Dim
  label: string
  chip: string
  auto?: boolean
  archived?: boolean
  revision?: number
  description?: string
}
export type Tag = {
  aiLabel?: string
  changeClass?: 'wording' | 'broader' | 'narrower' | 'redefined'
  displayLabel?: string
  inputVersion?: number
  review?: { unknown: number; needs_review: number }

  deleteRequested?: boolean
  ref?: string
  name: string
  dim: Dim
  auto: boolean
  enabled: boolean
  aliases: string
  desc: string
  user?: boolean
}
export type Article = {
  images?: { src: string }[]
  media?: {
    id: string
    title: string
    kind: 'video' | 'audio'
    content_type: string | null
    size: number
    status: string
  }[]
  bodyRevision?: number
  personalRevision?: number
  id: number
  kind: Kind
  title: string
  source: string
  url: string
  date: string
  lang: 'en-translated' | 'zh' | 'en' | 'unknown'
  summary: string
  body: string[]
  raw: string
  tags: string[]
  excluded: string[]
  cols: Record<string, string>
  links: { label: string; url: string }[]
  failed?: boolean
  classificationStatus?: string
  processingStatus?: string
  sourceAvailable?: boolean
  site?: { brand: string; status: 'ok' | 'dead'; checked: string; pricing: 'free' | 'freemium' | 'paid' }
}
export const needsAttention = (a: Article) => !!a.failed || a.site?.status === 'dead'
export const domainOf = (a: Article) =>
  a.url
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '')

// Demo clock is fixed to the design reference; API adapters use real ISO dates.
export const DEMO_TODAY = new Date(2026, 9, 12)
export const today = () =>
  DESIGN ? new Date(`${DESIGN_DATE}T00:00:00`) : LIVE ? new Date(new Date().setHours(0, 0, 0, 0)) : DEMO_TODAY
export const savedDate = (iso: string) => new Date(`${iso}T00:00:00`)
export const dateKey = (a: Pick<Article, 'date'>) => savedDate(a.date).getTime()
export const daysAgo = (a: Pick<Article, 'date'>) => Math.round((today().getTime() - dateKey(a)) / 864e5)
export const savedDateLabel = (iso: string) => formatDate(savedDate(iso))
export const contentLanguageLabel = (value: Article['lang']) => {
  const keys = {
    'en-translated': 'domain:englishTranslated',
    zh: 'domain:chinese',
    en: 'domain:english',
    unknown: 'domain:unknownLanguage',
  } as const
  return t(keys[value])
}
export const pricingLabel = (value: NonNullable<Article['site']>['pricing']) => {
  const keys = { free: 'domain:free', freemium: 'domain:freemium', paid: 'domain:paid' } as const
  return t(keys[value])
}
export const checkedLabel = (iso: string) =>
  t('domain:checkedToday', {
    time: formatDate(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }),
  })
export const dayLabel = (ago: number) => formatDate(new Date(today().getTime() - ago * 864e5))
export const RANGES = [
  {
    id: 'all',
    get label() {
      return t('app:all')
    },
    days: 0,
  },
  {
    id: '1',
    get label() {
      return t('domain:today')
    },
    days: 1,
  },
  {
    id: '3',
    get label() {
      return t('domain:last3Days')
    },
    days: 3,
  },
  {
    id: '7',
    get label() {
      return t('domain:last7Days')
    },
    days: 7,
  },
  {
    id: '30',
    get label() {
      return t('domain:lastMonth')
    },
    days: 30,
  },
] as const
// 'all' | '1' | '3' | '7' | '30' | 'd5'（某一天，距今 5 天）
export type Range = string
export const inRange = (a: Article, r: Range) => {
  if (r === 'all') return true
  const ago = daysAgo(a)
  if (r[0] === 'd') return ago === +r.slice(1)
  return ago >= 0 && ago < +r
}
export const rangeLabel = (r: Range) =>
  r[0] === 'd' ? dayLabel(+r.slice(1)) : (RANGES.find((x) => x.id === r)?.label ?? t('app:all'))

export type Collection = {
  ruleTagModes?: Record<string, 'exact' | 'with_narrower'>
  ruleExcludeModes?: Record<string, 'exact' | 'with_narrower'>
  count?: number
  rangeCount?: number
  id: string
  kind: Kind
  name: string
  purpose: string
  rule: string[]
  mode: 'any' | 'all'
  pinned: boolean
  archived: boolean
  deleted?: boolean
  ruleEnabled?: boolean
  exclude?: string[]
  admission?: 'direct' | 'review'
  confirmedOnly?: boolean
  backfill?: boolean
  itemOrder?: number[]
}

export const ruleMatch = (rule: string[], mode: 'any' | 'all', a: Article) =>
  rule.length > 0 && (mode === 'any' ? rule.some((t) => a.tags.includes(t)) : rule.every((t) => a.tags.includes(t)))

export const COL_DOT = ['#0b57d0', '#1e8e5a', '#d9822b', '#8e4ec6', '#c2410c', '#0e7490']
// 合集已被删除或不存在时，退回中性灰，避免 COL_DOT[-1]
export const colDot = (cols: Collection[], id: string) => {
  const i = cols.findIndex((c) => c.id === id)
  return i < 0 ? '#9aa0a6' : COL_DOT[i % COL_DOT.length]
}

export const USAGE = { classify: { used: 241, max: 300 }, enhance: { used: 86, max: 200 } }
export const queueStatus = (online: boolean) => ({
  queued: online ? 0 : 7,
  retry: online ? 0 : 3,
  done: online ? 131 : 128,
})

export const DIM_PALETTE = [
  'bg-[#e8eef7] text-[#0842a0]',
  'bg-[#e4f0e8] text-[#1e6b3a]',
  'bg-[#f6eedb] text-[#8a5a00]',
  'bg-[#eee8f6] text-[#6b3fa0]',
  'bg-[#dff1f2] text-[#0b5c63]',
  'bg-[#fbe6ec] text-[#9b1c47]',
  'bg-[#fdebdc] text-[#9a4a0c]',
  'bg-[#e9ebee] text-[#3c4043]',
]
export const DIMS0: DimDef[] = [
  { id: 'topic', label: '主题', chip: DIM_PALETTE[0] },
  { id: 'type', label: '资源类型', chip: DIM_PALETTE[1] },
  { id: 'trait', label: '内容特征', chip: DIM_PALETTE[2] },
  { id: 'medium', label: '载体', chip: DIM_PALETTE[3] },
]

export const relatedArticles = (site: Article, all: Article[]) => {
  const d = domainOf(site)
  return all.filter(
    (x) => x.kind === 'article' && !x.failed && (domainOf(x) === d || x.links.some((l) => l.url.includes(d))),
  )
}
export const relatedSites = (art: Article, all: Article[]) =>
  all.filter(
    (s) => s.kind === 'site' && (domainOf(art) === domainOf(s) || art.links.some((l) => l.url.includes(domainOf(s)))),
  )
