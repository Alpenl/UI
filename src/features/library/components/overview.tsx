import { useState } from 'react'
import { ClassificationStatus } from './classification-status'
import { today } from '@/domain/library'
import { formatDate } from '@/i18n'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { KINDS, colDot, dateKey, dayLabel, daysAgo, inRange, rangeLabel } from '@/domain/library'

import { RangeBar } from '@/components/domain/range-bar'

import type { LibProps } from '@/features/library/types'

import { Timeline } from '@/features/library/components/activity-timeline'

import { Icon } from '@/components/ui/icon'
import type { ReactNode } from 'react'

function Panel({
  title,
  count,
  action,
  tone,
  className = '',
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  tone?: 'warn'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`flex flex-col min-w-0 rounded-2xl border border-g-line bg-white shadow-[0_1px_2px_rgba(60,64,67,.05)] overflow-hidden ${className}`}
    >
      <header className="flex items-center gap-2.5 h-12 px-5 border-b border-g-line shrink-0">
        {tone === 'warn' && <span className="w-2 h-2 rounded-full bg-g-amber" aria-hidden="true" />}
        <h2 className="text-[12px] font-medium tracking-[.12em] text-g-sub uppercase">{title}</h2>
        {count !== undefined && (
          <span
            className={`text-[11px] tabular-nums rounded-full px-1.5 h-[18px] leading-[18px] ${tone === 'warn' ? 'bg-g-warn-bg text-g-warn-ink' : 'bg-g-surface text-g-sub'}`}
          >
            {count}
          </span>
        )}
        <span className="ml-auto">{action}</span>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex-1 min-h-[180px] grid place-items-center px-8 py-10 text-center">
      <div>
        <span className="mx-auto grid place-items-center w-10 h-10 rounded-full bg-g-paper border border-g-line text-g-mute">
          <Icon d={icon} className="w-[18px] h-[18px]" />
        </span>
        <p className="mt-3 text-[13px] text-g-sub max-w-[28ch] mx-auto leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

export function Overview(p: LibProps) {
  const { t: translate } = useTranslation()
  const [showAllFailed, setShowAllFailed] = useState(false)

  const WEEKDAY = formatDate(today(), { weekday: 'long' })
  const { kind, arts, cols, range, setRange } = p
  const open = p.setSel
  const data = p.server?.overview
  const failed = data ? data.failed : arts.filter((a) => a.failed || a.site?.status === 'dead')
  const ranged = data ? [] : arts.filter((a) => inRange(a, range))
  const placed = data?.placed ?? ranged.filter((a) => Object.keys(a.cols).length).length
  const tagCount = data?.tags ?? ranged.reduce((n, a) => n + a.tags.length, 0)
  const savedCount = data?.saved ?? ranged.length
  const totalCount = p.server?.facets.total ?? arts.length
  const failedCount = p.server?.facets.failed ?? failed.length
  const events = data
    ? data.events.map((e) => ({
        a: { id: e.id, title: e.title, date: e.date },
        text:
          e.type === 'collection'
            ? translate('library:automaticallyAddedTo', {
                collection: cols.find((c) => c.id === e.collection)?.name ?? translate('library:deletedCollection'),
              })
            : translate('library:generatedAndAppliedTags', {
                summaryType: translate('library:aSummary'),
                count: e.count,
              }),
        dot: e.collection ? colDot(cols, e.collection) : '#9aa0a6',
      }))
    : [...ranged]
        .filter((a) => !a.failed)
        .sort((x, y) => dateKey(y) - dateKey(x))
        .flatMap((a) => [
          ...Object.keys(a.cols).map((id) => ({
            a,
            text: translate('library:automaticallyAddedTo', {
              collection: cols.find((c) => c.id === id)?.name ?? translate('library:deletedCollection'),
            }),
            dot: colDot(cols, id),
          })),
          {
            a,
            text: translate('library:generatedAndAppliedTags', {
              summaryType: kind === 'site' ? translate('library:anIntroduction') : translate('library:aSummary'),
              count: a.tags.length,
            }),
            dot: '#9aa0a6',
          },
        ])
        .slice(0, 12)
  const groups = events.reduce<{ day: string; items: typeof events }[]>((g, e) => {
    const day = dayLabel(daysAgo(e.a))
    const last = g[g.length - 1]
    if (last?.day === day) last.items.push(e)
    else g.push({ day, items: [e] })
    return g
  }, [])
  const active = cols.filter((c) => !c.archived).sort((a, b) => +b.pinned - +a.pinned)
  const maxCount = Math.max(1, ...active.map((c) => c.count ?? arts.filter((a) => c.id in a.cols).length))
  const shownFailed = showAllFailed ? failed : failed.slice(0, 4)
  const scope = range === 'all' ? translate('library:allTime') : rangeLabel(range)

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-[900px] mx-auto px-10 pt-12 pb-20 rise">
        <div className="text-[12px] text-g-sub tracking-wide">
          {dayLabel(0)} · {WEEKDAY}
        </div>
        <h1 className="text-[34px] font-semibold mt-2 leading-tight text-balance">
          {range === 'all'
            ? translate('library:savedHeading', {
                count: totalCount,
                unit: KINDS[kind].unit,
                kind: KINDS[kind].noun,
              })
            : translate('library:organized', {
                range: scope,
                count: savedCount,
                unit: KINDS[kind].unit,
                kind: KINDS[kind].noun,
              })}
        </h1>
        <p className="text-[14.5px] text-g-sub mt-2 max-w-[56ch] leading-relaxed">
          {translate('library:summariesTagsAndCollectionsAreReadyTheList')}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <RangeBar range={range} setRange={setRange} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-g-sub mr-1">{translate('library:jumpTo')}</span>
          {failedCount > 0 && (
            <button
              onClick={() => p.setQuick('todo')}
              className="h-7 px-3 rounded-full bg-g-warn-bg text-g-warn-ink border border-g-warn-line font-medium hover:shadow-sm transition"
            >
              {translate('library:needsAttentionCount', { count: failedCount })}
            </button>
          )}
          {active.slice(0, 4).map((c) => (
            <button
              key={c.id}
              onClick={() => p.goCol(c.id)}
              className="h-7 px-3 rounded-full border border-g-line bg-white hover:border-g-mute inline-flex items-center gap-1.5 transition"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: colDot(cols, c.id) }} />
              {c.name}
            </button>
          ))}
          {(data?.latest_id || ranged[0]) && (
            <button
              onClick={() => open(data?.latest_id ?? [...ranged].sort((x, y) => dateKey(y) - dateKey(x))[0].id)}
              className="h-7 px-3 rounded-full border border-g-line bg-white hover:border-g-mute transition"
            >
              {translate('library:latestArticle')}
            </button>
          )}
        </div>

        <dl className="grid grid-cols-4 mt-9 bg-white border border-g-line rounded-2xl shadow-[0_1px_2px_rgba(60,64,67,.06)] divide-x divide-g-line overflow-hidden max-[1100px]:grid-cols-2 max-[1100px]:divide-y">
          {[
            [
              savedCount,
              range === 'all' ? translate('library:savedMetric') : translate('library:savedInRange', { range: scope }),
              'text-g-text',
            ],
            [tagCount, translate('library:tagsApplied'), 'text-g-text'],
            [placed, translate('library:autoCollected'), 'text-g-blue'],
            [failedCount, translate('library:needsAttention'), 'text-g-warn'],
          ].map(([n, l, c]) => (
            <div key={l as string} className="px-6 py-5">
              <dd className={`font-serif text-[36px] leading-none tabular-nums ${c}`}>{n}</dd>
              <dt className="text-[12.5px] text-g-sub mt-2.5">{l}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-12">
          <Timeline days={data?.days} arts={arts} range={range} setRange={setRange} />
        </div>

        {failed.length > 0 && (
          <Panel
            className="mt-12"
            title={translate('library:takeALook')}
            count={failed.length}
            tone="warn"
            action={
              failed.length > 4 && (
                <button
                  onClick={() => setShowAllFailed((v) => !v)}
                  aria-expanded={showAllFailed}
                  className="text-[12.5px] font-medium text-g-blue hover:underline"
                >
                  {showAllFailed
                    ? translate('library:showLess')
                    : translate('library:showAllCount', { count: failed.length })}
                </button>
              )
            }
          >
            <ul className="divide-y divide-g-line">
              {shownFailed.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => open(a.id)}
                    className="group w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3.5 text-left hover:bg-g-paper transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-g-amber" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-serif text-[15px] font-medium leading-snug truncate group-hover:text-g-blue transition">
                        {a.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-g-sub">
                        <span className="font-medium text-g-warn-ink">
                          {a.site?.status === 'dead'
                            ? translate('library:brokenLink')
                            : kind === 'site'
                              ? translate('library:siteInformationUnavailable')
                              : a.sourceAvailable
                                ? translate('library:processingIncomplete')
                                : translate('library:contentUnavailable')}
                        </span>
                        <span className="text-g-line" aria-hidden="true">
                          /
                        </span>
                        <span className="truncate">
                          {a.site?.status === 'dead'
                            ? translate('library:unavailableInRecentChecks')
                            : a.sourceAvailable
                              ? translate('library:savedSourceStillReadable')
                              : translate('library:recaptureTheOriginalPageWithTheBrowserExtension')}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3 max-[640px]:hidden">
                      <ClassificationStatus article={a} />
                      <Icon
                        d="M9 6l6 6-6 6"
                        className="w-3.5 h-3.5 text-g-mute transition group-hover:translate-x-0.5 group-hover:text-g-blue"
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="grid grid-cols-2 gap-5 mt-5 items-stretch max-[900px]:grid-cols-1">
          <Panel
            title={translate('library:recentActivity')}
            count={events.length || undefined}
            className={failed.length ? '' : 'mt-7'}
          >
            {groups.length === 0 ? (
              <Empty
                icon="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"
                text={translate('library:noNewActivityInTryAWiderTime', { range: scope })}
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto scroll-quiet px-5 pb-3">
                {groups.map((g) => (
                  <div key={g.day}>
                    <div className="sticky top-0 bg-white flex items-center gap-3 pt-3 pb-1.5 text-[11.5px] text-g-sub tabular-nums">
                      <span className="font-medium text-g-ink">{g.day}</span>
                      <span className="flex-1 h-px bg-g-line" />
                      <span>{translate('library:events', { count: g.items.length })}</span>
                    </div>
                    <ul className="relative before:absolute before:left-[3px] before:top-3 before:bottom-3 before:w-px before:bg-g-line">
                      {g.items.map((e, i) => (
                        <li key={i}>
                          <button
                            onClick={() => open(e.a.id)}
                            className="group relative w-full flex items-start gap-3 py-2 text-left"
                          >
                            <span
                              className="relative w-[7px] h-[7px] rounded-full mt-[7px] shrink-0 ring-2 ring-white"
                              style={{ background: e.dot }}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13.5px] truncate font-medium group-hover:text-g-blue transition">
                                {e.a.title}
                              </span>
                              <span className="block text-[12px] text-g-sub mt-0.5 truncate">{e.text}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={translate('library:collectionGrowth')}
            count={active.length || undefined}
            className={failed.length ? '' : 'mt-7'}
          >
            {active.length === 0 ? (
              <Empty icon="M4 6h16M4 12h16M4 18h10" text={translate('library:noCollectionsYet')} />
            ) : (
              <ul className="px-2 py-2">
                {active.map((c) => {
                  const n = c.count ?? arts.filter((a) => c.id in a.cols).length
                  const inR = c.rangeCount ?? ranged.filter((a) => c.id in a.cols).length
                  const dot = colDot(cols, c.id)
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => p.goCol(c.id)}
                        className="group w-full px-3 py-2.5 rounded-lg text-left hover:bg-g-paper transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
                          <span className="flex-1 text-[13.5px] truncate group-hover:text-g-blue transition">
                            {c.name}
                          </span>
                          {range !== 'all' && inR > 0 && (
                            <span className="text-[11.5px] text-g-green font-medium tabular-nums bg-g-ok/10 rounded-full px-1.5">
                              +{inR}
                            </span>
                          )}
                          <span className="font-serif text-[15px] tabular-nums text-g-ink">{n}</span>
                        </span>
                        <span className="mt-2 ml-[18px] block h-1 rounded-full bg-g-surface overflow-hidden">
                          <span
                            className="block h-full rounded-full transition-[width] duration-500"
                            style={{ width: Math.max(4, (n / maxCount) * 100) + '%', background: dot }}
                          />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
