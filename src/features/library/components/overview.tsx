import { ClassificationStatus } from './classification-status'
import { today } from '@/domain/library'
import { formatDate } from '@/i18n'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { KINDS, colDot, dateKey, dayLabel, daysAgo, inRange, rangeLabel } from '@/domain/library'

import { RangeBar } from '@/components/domain/range-bar'

import type { LibProps } from '@/features/library/types'

import { Timeline } from '@/features/library/components/activity-timeline'

import { Label } from '@/components/ui/section-label'

export function Overview(p: LibProps) {
  const { t: translate } = useTranslation()

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
  const scope = range === 'all' ? translate('library:allTime') : rangeLabel(range)

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-[860px] mx-auto px-10 py-10 rise">
        <div className="text-[12px] text-g-sub tracking-wide">
          {dayLabel(0)} · {WEEKDAY}
        </div>
        <h1 className="text-[30px] font-semibold mt-1.5 leading-tight">
          {range === 'all'
            ? translate('library:savedHeading', { count: totalCount, unit: KINDS[kind].unit, kind: KINDS[kind].noun })
            : translate('library:organized', {
                range: scope,
                count: savedCount,
                unit: KINDS[kind].unit,
                kind: KINDS[kind].noun,
              })}
        </h1>
        <p className="text-[14px] text-g-sub mt-1.5">
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

        <dl className="grid grid-cols-4 mt-8 border border-g-line rounded-xl divide-x divide-g-line overflow-hidden max-[1100px]:grid-cols-2 max-[1100px]:divide-y">
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
            <div key={l as string} className="px-5 py-4">
              <dd className={`font-serif text-[32px] leading-none tabular-nums ${c}`}>{n}</dd>
              <dt className="text-[12.5px] text-g-sub mt-2">{l}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <Timeline days={data?.days} arts={arts} range={range} setRange={setRange} />
        </div>

        <div className="grid grid-cols-[1.35fr_1fr] gap-10 mt-10 max-[1100px]:grid-cols-1">
          <section>
            <Label>{translate('library:recentActivity')}</Label>
            {groups.length === 0 && (
              <p className="text-[13px] text-g-sub border-t border-g-line pt-3">
                {translate('library:noNewActivityInTryAWiderTime', { range: scope })}
              </p>
            )}
            {groups.map((g) => (
              <div key={g.day}>
                <div className="flex items-center gap-3 py-2 border-t border-g-line text-[12px] text-g-sub tabular-nums">
                  <span>{g.day}</span>
                  <span className="flex-1 h-px bg-g-line" />
                  <span>{translate('library:events', { count: g.items.length })}</span>
                </div>
                <ul>
                  {g.items.map((e, i) => (
                    <li key={i}>
                      <button
                        onClick={() => open(e.a.id)}
                        className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-g-paper -mx-2 px-2 rounded transition"
                      >
                        <span className="w-2 h-2 rounded-full mt-[7px] shrink-0" style={{ background: e.dot }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] truncate font-medium">{e.a.title}</span>
                          <span className="block text-[12.5px] text-g-sub mt-0.5">{e.text}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="space-y-9">
            <section>
              <Label>{translate('library:takeALook')}</Label>
              {failed.length === 0 ? (
                <p className="text-[13px] text-g-sub border-t border-g-line pt-3">
                  {translate('library:everythingLooksGood')}
                </p>
              ) : (
                <div className="space-y-2">
                  {failed.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => open(a.id)}
                      className="w-full text-left rounded-xl bg-g-warn-bg border border-g-warn-line p-4 hover:shadow-sm transition"
                    >
                      <div className="text-[12px] font-medium text-g-warn-ink">
                        {a.site?.status === 'dead'
                          ? translate('library:brokenLink')
                          : kind === 'site'
                            ? translate('library:siteInformationUnavailable')
                            : a.sourceAvailable
                              ? translate('library:processingIncomplete')
                              : translate('library:contentUnavailable')}
                      </div>
                      <ClassificationStatus article={a} />
                      <div className="font-serif text-[15px] font-medium mt-1 leading-snug">{a.title}</div>
                      <div className="text-[12.5px] text-g-sub mt-2 leading-relaxed">
                        {a.site?.status === 'dead'
                          ? translate('library:unavailableInRecentChecks')
                          : a.sourceAvailable
                            ? translate('library:savedSourceStillReadable')
                            : translate('library:recaptureTheOriginalPageWithTheBrowserExtension')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <Label>{translate('library:collectionGrowth')}</Label>
              <ul className="border-t border-g-line">
                {active.map((c) => {
                  const n = c.count ?? arts.filter((a) => c.id in a.cols).length
                  const inR = c.rangeCount ?? ranged.filter((a) => c.id in a.cols).length
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => p.goCol(c.id)}
                        className="w-full flex items-center gap-3 py-2.5 border-b border-g-line text-left hover:bg-g-paper -mx-2 px-2 rounded transition"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: colDot(cols, c.id) }} />
                        <span className="flex-1 text-[13.5px] truncate">{c.name}</span>
                        {range !== 'all' && inR > 0 && (
                          <span className="text-[12px] text-g-ok font-medium tabular-nums">+{inR}</span>
                        )}
                        <div className="w-16 h-1 rounded-full bg-g-surface overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: Math.min(100, n * 40) + '%', background: colDot(cols, c.id) }}
                          />
                        </div>
                        <span className="text-[12.5px] tabular-nums text-g-sub w-5 text-right">{n}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
