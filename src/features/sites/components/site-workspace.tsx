import i18n from '@/i18n'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useEffect, useMemo, useState } from 'react'

import { colDot, dateKey } from '@/domain/library'

import { RangeBar } from '@/components/domain/range-bar'
import { Chip } from '@/components/domain/tag-chip'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import { OtherHits } from '@/features/library/components/other-hits'
import { MAX_TAGS, type LibProps } from '@/features/library/types'

import type { Sort } from '@/features/sites/types'

import { Tile } from '@/features/sites/components/site-tile'

import { StatusPill } from '@/features/sites/components/status-pill'

import { Drawer } from '@/features/sites/components/site-drawer'

export function SiteWorkspace(p: LibProps) {
  const { t: translate } = useTranslation()

  const locale = i18n.resolvedLanguage
  const [sort, setSort] = useState<Sort>('recent')
  const [pickedRaw, setPicked] = useState<number[]>([])
  const [menu, setMenu] = useState<'col' | 'tag' | null>(null)
  const [bannerOff, setBannerOff] = useState(false)
  const deadN = p.arts.filter((x) => x.site?.status === 'dead').length

  const list = useMemo(() => {
    const base = [...p.shown].sort((a, b) =>
      sort === 'name' ? a.title.localeCompare(b.title, locale) : dateKey(b) - dateKey(a),
    )
    return base.sort((a, b) => +(a.site?.status === 'dead') - +(b.site?.status === 'dead'))
  }, [p.shown, sort, locale])

  // 已被筛选掉的项不再计入批量选择，避免对看不见的项操作
  const picked = useMemo(() => pickedRaw.filter((id) => list.some((x) => x.id === id)), [pickedRaw, list])

  const togglePick = (id: number) => setPicked(picked.includes(id) ? picked.filter((y) => y !== id) : [...picked, id])
  const batchCol = (cid: string) => {
    const all = picked.every((id) => cid in (p.arts.find((x) => x.id === id)?.cols ?? {}))
    picked.forEach((id) =>
      p.update(id, (x) => {
        const c = { ...x.cols }
        if (all) delete c[cid]
        else if (!(cid in c)) c[cid] = ''
        return { ...x, cols: c }
      }),
    )
  }
  const batchTag = (n: string) => {
    const all = picked.every((id) => p.arts.find((x) => x.id === id)?.tags.includes(n))
    picked.forEach((id) =>
      p.update(id, (x) =>
        all
          ? { ...x, tags: x.tags.filter((t) => t !== n) }
          : x.tags.includes(n) || x.tags.length >= MAX_TAGS
            ? x
            : { ...x, tags: [...x.tags, n], excluded: x.excluded.filter((e) => e !== n) },
      ),
    )
  }
  const a = p.arts.find((x) => x.id === p.sel) ?? null

  const { setSel } = p
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.key === 'Escape') {
        if (menu) setMenu(null)
        else if (picked.length) setPicked([])
        else setSel(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setSel, picked.length, menu])

  return (
    <div className="h-full flex relative overflow-hidden bg-g-paper">
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 px-8 pt-7 pb-4">
          <div className="flex items-end gap-6">
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight truncate">{p.heading}</h1>
              <p className="text-[13px] text-g-sub mt-1">
                {translate('sites:websites', { count: list.length })}
                {p.filtering && (
                  <button onClick={p.clear} className="ml-2 text-g-blue font-medium hover:underline">
                    {translate('sites:clearFilters')}
                  </button>
                )}
              </p>
            </div>
            <div className="ml-auto relative w-72 max-[1100px]:w-56">
              <Icon d={P.search} className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-g-sub" />
              <input
                value={p.q}
                onChange={(e) => p.setQ(e.target.value)}
                placeholder={translate('sites:searchNamesDescriptionsAndUrls')}
                aria-label={translate('sites:searchWebsites')}
                className="w-full h-10 pl-10 pr-9 rounded-full bg-white border border-g-line text-[14px] focus:border-g-blue focus:shadow-[0_0_0_3px_rgba(11,87,208,.1)] outline-none transition"
              />
              {p.q && (
                <button
                  onClick={() => p.setQ('')}
                  aria-label={translate('library:clear')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full hover:bg-g-surface text-g-sub"
                >
                  <Icon d={P.x} className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {deadN > 0 && p.quick !== 'todo' && !bannerOff && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-g-danger-bg px-4 py-2.5 text-[13px] text-g-danger-ink">
              <span className="w-2 h-2 rounded-full bg-g-red shrink-0" />
              <span className="flex-1">
                {translate('sites:websitesWereRecentlyUnavailableAndHaveBeenMoved', { count: deadN })}
              </span>
              <button onClick={() => p.setQuick('todo')} className="font-medium underline underline-offset-2">
                {translate('sites:view')}
              </button>
              <button
                onClick={() => setBannerOff(true)}
                aria-label={translate('sites:dismiss')}
                className="w-6 h-6 grid place-items-center rounded-full hover:bg-black/10"
              >
                <Icon d={P.x} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <RangeBar range={p.range} setRange={p.setRange} />
            <div
              role="group"
              aria-label={translate('sites:sort')}
              className="ml-auto flex rounded-full bg-g-surface p-0.5 text-[12.5px]"
            >
              {(
                [
                  ['recent', translate('sites:recentlySaved')],
                  ['name', translate('sites:name')],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  aria-pressed={sort === v}
                  className={`h-6 px-3 rounded-full transition ${sort === v ? 'bg-white shadow-sm font-medium' : 'text-g-sub'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <OtherHits hits={p.otherHits} jump={p.jump} />
        <div className="flex-1 overflow-y-auto scroll-quiet px-8 pb-24 pt-5">
          {list.length === 0 ? (
            <p className="py-24 text-center text-[13px] text-g-sub">{translate('sites:noMatchingWebsites')}</p>
          ) : (
            <ul className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(236px,1fr))] rise">
              {list.map((s) => {
                const on = p.sel === s.id
                const dead = s.site?.status === 'dead'
                const chk = picked.includes(s.id)
                return (
                  <li key={s.id} className="relative group">
                    <button
                      onClick={() => (picked.length ? togglePick(s.id) : p.setSel(on ? null : s.id))}
                      aria-pressed={on}
                      aria-label={translate('sites:viewDetails', { name: s.title })}
                      className={`h-full w-full text-left flex flex-col rounded-2xl bg-white border overflow-hidden cursor-pointer transition ${on || chk ? 'border-g-blue shadow-[0_0_0_3px_rgba(11,87,208,.12)]' : 'border-g-line hover:shadow-[0_6px_20px_rgba(60,64,67,.12)] hover:-translate-y-0.5'}`}
                    >
                      <Tile a={s} />
                      <span className="p-4 flex-1 flex flex-col w-full">
                        <span className="flex items-start gap-2">
                          <span
                            className={`flex-1 font-serif text-[17px] font-semibold leading-snug ${dead ? 'text-g-sub line-through decoration-1' : ''}`}
                          >
                            {s.title}
                          </span>
                          <StatusPill a={s} />
                        </span>
                        {s.failed ? (
                          <span className="block text-[12.5px] leading-relaxed text-g-sub mt-1.5">
                            {translate('sites:siteInformationAwaitingCapture')}
                          </span>
                        ) : (
                          <span className="block text-[12.5px] leading-[1.65] text-g-sub mt-1.5 line-clamp-2">
                            {s.summary}
                          </span>
                        )}
                        <span className="mt-auto pt-3 flex items-center gap-1.5 flex-wrap">
                          {s.tags.slice(0, 2).map((t) => (
                            <Chip key={t} dim={p.dimOf(t)}>
                              {t}
                            </Chip>
                          ))}
                          <span className="ml-auto flex gap-1">
                            {Object.keys(s.cols).map((id) => (
                              <span
                                key={id}
                                title={p.cols.find((c) => c.id === id)?.name}
                                className="w-2 h-2 rounded-full"
                                style={{ background: colDot(p.cols, id) }}
                              />
                            ))}
                          </span>
                        </span>
                      </span>
                    </button>
                    <button
                      role="checkbox"
                      aria-checked={chk}
                      aria-label={translate('sites:select', { name: s.title })}
                      onClick={() => togglePick(s.id)}
                      className={`absolute top-3 left-3 w-6 h-6 rounded-md border-2 grid place-items-center transition ${chk ? 'bg-g-blue border-g-blue text-white opacity-100' : `bg-white/90 border-white/90 text-transparent ${picked.length ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}`}
                    >
                      <Icon d={P.check} className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={translate('sites:visitSite', { name: s.title })}
                      className="absolute top-3 right-3 h-8 px-3 rounded-full bg-white/95 text-g-text text-[12.5px] font-medium inline-flex items-center gap-1 shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                    >
                      {translate('sites:visit')}
                      <Icon d={P.ext} className="w-3.5 h-3.5" />
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {picked.length > 0 && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-6 rounded-full bg-g-text text-white shadow-[0_8px_28px_rgba(0,0,0,.28)] pl-5 pr-2 h-12 flex items-center gap-1 rise">
          <span className="text-[13.5px] mr-2 tabular-nums">
            {translate('sites:selected', { count: picked.length })}
          </span>
          {(
            [
              ['col', translate('sites:addToCollection')],
              ['tag', translate('sites:addTags')],
            ] as const
          ).map(([m, l]) => (
            <div key={m} className="relative">
              <button
                onClick={() => setMenu(menu === m ? null : m)}
                aria-expanded={menu === m}
                className={`h-9 px-4 rounded-full text-[13.5px] font-medium ${menu === m ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                {l}
              </button>
              {menu === m && (
                <div className="absolute bottom-12 left-0 w-56 max-h-64 overflow-y-auto scroll-quiet rounded-xl bg-white text-g-text shadow-[0_8px_24px_rgba(0,0,0,.2)] py-1">
                  {m === 'col'
                    ? p.cols
                        .filter((c) => !c.archived)
                        .map((c) => {
                          const all = picked.every((id) => c.id in (p.arts.find((x) => x.id === id)?.cols ?? {}))
                          return (
                            <button
                              key={c.id}
                              onClick={() => batchCol(c.id)}
                              className="w-full h-9 px-4 text-left text-[13px] hover:bg-g-surface flex items-center justify-between"
                            >
                              {c.name}
                              {all && <Icon d={P.check} className="w-4 h-4 text-g-blue" />}
                            </button>
                          )
                        })
                    : p.tags
                        .filter((t) => t.enabled)
                        .map((t) => {
                          const all = picked.every((id) => p.arts.find((x) => x.id === id)?.tags.includes(t.name))
                          return (
                            <button
                              key={t.name}
                              onClick={() => batchTag(t.name)}
                              className="w-full h-9 px-4 text-left text-[13px] hover:bg-g-surface flex items-center justify-between"
                            >
                              {t.name}
                              {all && <Icon d={P.check} className="w-4 h-4 text-g-blue" />}
                            </button>
                          )
                        })}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              setPicked([])
              setMenu(null)
            }}
            aria-label={translate('sites:clearSelection')}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"
          >
            <Icon d={P.x} className="w-4 h-4" />
          </button>
        </div>
      )}

      {a && <Drawer key={a.id} a={a} {...p} close={() => p.setSel(null)} />}
    </div>
  )
}
