import { today } from '@/domain/library'
import { formatDate } from '@/i18n'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useMemo, useState } from 'react'

import { dayLabel, daysAgo, type Article, type Range } from '@/domain/library'

import { Label } from '@/components/ui/section-label'

export const WEEKS = 53

export const LEVELS = [
  'bg-g-surface border border-[#e1e6ee]',
  'bg-[#c7d9f5]',
  'bg-[#7fa8e8]',
  'bg-[#3b78dc]',
  'bg-g-blue-dark',
]

export const level = (n: number) => (n === 0 ? 0 : Math.min(4, n))

export const TODAY_DOW = today().getDay()

export function Timeline({
  arts,
  range,
  setRange,
  days,
}: {
  days?: { day: string; n: number }[]
  arts: Article[]
  range: Range
  setRange: (r: Range) => void
}) {
  const { t: translate } = useTranslation()

  const [hover, setHover] = useState<number | null>(null)
  const byDay = useMemo(() => {
    if (days) return new Map(days.map((d) => [daysAgo({ date: d.day } as Article), d.n]))
    const result = new Map<number, number>()
    arts.forEach((a) => result.set(daysAgo(a), (result.get(daysAgo(a)) ?? 0) + 1))
    return result
  }, [arts, days])
  // 列 = 周（周日起），行 = 星期；最后一列只到今天
  const cells = Array.from({ length: WEEKS * 7 }, (_, k) => {
    const w = Math.floor(k / 7)
    const r = k % 7
    const ago = (WEEKS - 1 - w) * 7 + (TODAY_DOW - r)
    return { ago, r, w }
  })
  const on = (ago: number) => range === 'all' || (range[0] === 'd' ? ago === +range.slice(1) : ago < +range)
  const total = cells.reduce((n, c) => n + (c.ago >= 0 ? (byDay.get(c.ago) ?? 0) : 0), 0)
  const months = Array.from({ length: WEEKS }, (_, w) => {
    const d = new Date(today().getTime() - cells[w * 7].ago * 864e5)
    const prev = w > 0 ? new Date(today().getTime() - cells[(w - 1) * 7].ago * 864e5) : null
    return !prev || prev.getMonth() !== d.getMonth() ? formatDate(d, { month: 'short' }) : ''
  })
  if (months[1] || months[2]) months[0] = ''
  return (
    <section>
      <Label
        right={
          <span className="text-[12.5px] text-g-sub tabular-nums" aria-live="polite">
            {hover !== null
              ? translate('library:items', { date: dayLabel(hover), count: byDay.get(hover) ?? 0 })
              : translate('library:selectADayToFilter')}
          </span>
        }
      >
        {translate('library:itemsSavedInThePastYear', { count: total })}
      </Label>
      <div className="rounded-xl border border-g-line p-4 pt-3.5">
        <div className="grid grid-cols-[22px_1fr] gap-x-2" onMouseLeave={() => setHover(null)}>
          <span />
          <div
            className="grid gap-[3px] text-[11px] text-g-sub h-4 mb-1"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0,1fr))` }}
            aria-hidden="true"
          >
            {months.map((m, w) => (
              <span key={w} className="overflow-visible whitespace-nowrap">
                {m}
              </span>
            ))}
          </div>
          <div className="grid grid-rows-7 gap-[3px] text-[11px] text-g-sub" aria-hidden="true">
            {['', translate('library:m'), '', translate('library:w'), '', translate('library:f'), ''].map((l, i) => (
              <span key={i} className="flex items-center leading-none">
                {l}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0,1fr))` }}
          >
            {cells.map((c) => {
              if (c.ago < 0) return <span key={c.ago + '_' + c.r} />
              const n = byDay.get(c.ago) ?? 0
              const picked = range === 'd' + c.ago
              return (
                <button
                  key={c.ago}
                  onClick={() => setRange(picked ? 'all' : 'd' + c.ago)}
                  onMouseEnter={() => setHover(c.ago)}
                  onFocus={() => setHover(c.ago)}
                  onBlur={() => setHover(null)}
                  aria-label={translate('library:itemsSaved', { date: dayLabel(c.ago), count: n })}
                  aria-pressed={picked}
                  className={`aspect-square rounded-[3px] transition-opacity hover:ring-1 hover:ring-g-text/40 ${LEVELS[level(n)]} ${on(c.ago) ? '' : 'opacity-35'} ${picked ? 'ring-2 ring-g-text ring-offset-1' : ''}`}
                />
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11.5px] text-g-sub">
          {translate('library:less')}
          {LEVELS.map((l, i) => (
            <span key={i} className={`w-3 h-3 rounded-[3px] ${l}`} />
          ))}
          {translate('library:more')}
        </div>
      </div>
    </section>
  )
}
