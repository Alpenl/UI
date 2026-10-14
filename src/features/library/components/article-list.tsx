import { ClassificationStatus } from './classification-status'
import { TagFilterScopes } from '@/features/tags/components/tag-filter-scopes'
import { useEffect, useRef, useState } from 'react'
import { savedDateLabel } from '@/domain/library'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { KINDS, colDot } from '@/domain/library'

import { RangeBar } from '@/components/domain/range-bar'
import { Chip } from '@/components/domain/tag-chip'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import type { LibProps } from '@/features/library/types'

import { OtherHits } from '@/features/library/components/other-hits'

import { Mark } from '@/components/ui/search-highlight'

import { MAX_TAGS } from '@/features/library/types'

export function ArticleList(p: LibProps) {
  const { t: translate } = useTranslation()

  const { shown, q, sel, cols } = p
  const fTags = p.fTags ?? []
  const [editingTags, setEditingTags] = useState(false)
  if (editingTags && fTags.length === 0) setEditingTags(false)
  const intentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelIntent = () => clearTimeout(intentTimer.current)
  useEffect(() => () => clearTimeout(intentTimer.current), [])
  const prepare = (id: number) => {
    cancelIntent()
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection
    if (connection?.saveData || connection?.effectiveType?.includes('2g')) return
    intentTimer.current = setTimeout(() => p.prefetch?.(id), 150)
  }
  return (
    <section className="h-full flex flex-col bg-g-paper border-r border-g-line min-w-0">
      <div className="p-4 pb-3 space-y-3 shrink-0">
        <div className="relative">
          <Icon d={P.search} className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-g-sub" />
          <input
            value={q}
            onChange={(e) => p.setQ(e.target.value)}
            placeholder={translate('library:searchTitlesSummariesContentAndLinks')}
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-white border border-g-line text-[14px] focus:border-g-blue focus:shadow-[0_0_0_3px_rgba(11,87,208,.1)] outline-none transition"
          />
          {q && (
            <button
              onClick={() => p.setQ('')}
              aria-label={translate('library:clear')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full hover:bg-g-surface text-g-sub"
            >
              <Icon d={P.x} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-semibold truncate">{p.heading}</h2>
          <span className="text-[12px] text-g-sub shrink-0 flex items-baseline gap-2">
            <span className="tabular-nums">
              {p.loading ? '…' : (p.server?.total ?? shown.length)} {KINDS[p.kind].unit}
            </span>
            {editingTags ? (
              <>
                <button onClick={p.clear} className="text-g-red font-medium hover:underline">
                  {translate('library:clearAll')}
                </button>
                <button onClick={() => setEditingTags(false)} className="text-g-blue font-medium hover:underline">
                  {translate('admin:done')}
                </button>
              </>
            ) : (
              p.filtering && (
                <button
                  onClick={() => (fTags.length ? setEditingTags(true) : p.clear())}
                  className="text-g-blue font-medium hover:underline"
                >
                  {translate('library:clear')}
                </button>
              )
            )}
          </span>
        </div>
        <TagFilterScopes tags={fTags} dimOf={p.dimOf} editing={editingTags} remove={(n) => p.toggleTag?.(n)} />
        {p.server?.reconciling && (
          <p role="status" className="text-[12px] text-g-sub">
            {translate('admin:reconcilingRules')}
          </p>
        )}
        <RangeBar range={p.range} setRange={p.setRange} />
      </div>

      <div aria-busy={p.loading || p.fetching} className="flex-1 overflow-y-auto scroll-quiet border-t border-g-line">
        <OtherHits hits={p.otherHits} jump={p.jump} />
        {!p.loading && !p.loadingError && shown.length === 0 && (
          <p className="py-16 text-center text-[13px] text-g-sub">{translate('library:noMatchingResources')}</p>
        )}
        {p.loadingError && (
          <div className="px-4 py-6 text-[13px] text-g-sub" role="alert">
            <p>{translate('common:liveLoadError')}</p>
            <button className="mt-3 text-g-blue" onClick={p.retryLoading}>
              {translate('common:retryRead')}
            </button>
          </div>
        )}
        {p.loading && (
          <p role="status" className="px-4 py-3 text-[13px] text-g-sub">
            {translate('common:loadingResults')}
          </p>
        )}
        {shown.map((a) => {
          const on = sel === a.id
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onMouseEnter={() => prepare(a.id)}
              onMouseLeave={cancelIntent}
              onFocus={(e) => {
                if (e.target === e.currentTarget) prepare(a.id)
              }}
              onBlur={cancelIntent}
              onClick={() => {
                cancelIntent()
                p.setSel(a.id)
              }}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  p.setSel(a.id)
                }
              }}
              aria-current={on ? 'true' : undefined}
              className={`group relative w-full text-left px-4 py-3.5 border-b border-g-line transition cursor-pointer ${on ? 'bg-white' : 'hover:bg-white/70'}`}
            >
              {on && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-g-blue" />}
              {p.trashArticle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    p.trashArticle!(a.id)
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  title={translate('library:moveToTrash')}
                  aria-label={`${translate('library:moveToTrash')}: ${a.title}`}
                  className="absolute right-3 top-2.5 z-[1] w-7 h-7 grid place-items-center rounded-full bg-white border border-g-line text-g-sub opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 max-[900px]:opacity-100 hover:text-g-red hover:bg-g-danger-bg hover:border-transparent"
                >
                  <Icon d={P.trash} className="w-3.5 h-3.5" />
                </button>
              )}
              {p.server?.match_reasons?.[a.id]
                ?.filter((reason) => reason.requested_ref !== reason.via_ref)
                .map((reason) => (
                  <p key={`${reason.requested_ref}/${reason.via_ref}`} className="text-[12px] text-g-sub">
                    {translate('admin:matchedVia', {
                      parent: p.tags.find((tag) => tag.ref === reason.requested_ref)?.name ?? reason.requested_ref,
                      child: p.tags.find((tag) => tag.ref === reason.via_ref)?.name ?? reason.via_ref,
                    })}
                  </p>
                ))}
              <div className="flex items-center gap-2 text-[12px] text-g-sub">
                <span className="text-g-green truncate">{a.source}</span>
                <span className="shrink-0">· {savedDateLabel(a.date)}</span>
                <ClassificationStatus article={a} />
                {a.failed && !a.classificationStatus && (
                  <span className="ml-auto shrink-0 text-g-warn font-medium">{translate('library:incomplete')}</span>
                )}
              </div>
              <h3
                className={`font-serif text-[16px] leading-snug mt-1 truncate ${on ? 'text-g-blue-dark' : ''} font-medium`}
              >
                <Mark text={a.title} q={q} />
              </h3>
              {(!a.failed || a.sourceAvailable) && (
                <>
                  <p className="text-[12.5px] leading-[1.65] text-g-sub mt-1.5 line-clamp-2">
                    <Mark text={a.summary} q={q} />
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {a.tags.slice(0, MAX_TAGS).map((t) => (
                      <Chip
                        key={t}
                        dim={p.dimOf(t)}
                        active={p.fTags?.includes(t)}
                        onClick={p.toggleTag ? () => p.toggleTag!(t) : undefined}
                      >
                        {t}
                      </Chip>
                    ))}
                    <span className="ml-auto flex gap-1">
                      {Object.keys(a.cols).map((id) => (
                        <span
                          key={id}
                          title={cols.find((c) => c.id === id)?.name}
                          className="w-2 h-2 rounded-full"
                          style={{ background: colDot(cols, id) }}
                        />
                      ))}
                    </span>
                  </div>
                </>
              )}
            </div>
          )
        })}
        {(p.previousPage || p.nextPage) && (
          <div className="flex justify-between p-4 text-[13px] text-g-blue">
            <button disabled={!p.previousPage || p.loading || p.fetching} onClick={p.previousPage}>
              {translate('common:previousPage')}
            </button>
            <button disabled={!p.nextPage || p.loading || p.fetching} onClick={p.nextPage}>
              {translate('admin:nextPage')}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
