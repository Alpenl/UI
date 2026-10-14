import { MutationBoundary } from '@/components/ui/mutation-lock'
import { contentLanguageLabel, savedDateLabel } from '@/domain/library'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useState } from 'react'

import { colDot, type Article } from '@/domain/library'

import { Chip } from '@/components/domain/tag-chip'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { useDims } from '@/features/tags/dimensions'

import type { LibProps } from '@/features/library/types'

import { MAX_TAGS } from '@/features/library/types'

import { Label } from '@/components/ui/section-label'

export function OrganizeBody({
  a,
  tags,
  cols,
  update,
  dimOf,
}: Pick<LibProps, 'tags' | 'cols' | 'update' | 'dimOf'> & { a: Article }) {
  const { t: translate } = useTranslation()

  const { def } = useDims()
  const [adding, setAdding] = useState(false)
  const addable = tags.filter((t) => t.enabled && !a.tags.includes(t.name))
  const removeTag = (n: string) =>
    update(a.id, (x) => ({ ...x, tags: x.tags.filter((t) => t !== n), excluded: [...x.excluded, n] }))
  const full = a.tags.length >= MAX_TAGS
  const addTag = (n: string) => {
    if (full) return
    update(a.id, (x) => ({ ...x, tags: [...x.tags, n], excluded: x.excluded.filter((e) => e !== n) }))
    setAdding(false)
  }
  const toggleCol = (id: string) =>
    update(a.id, (x) => {
      const c = { ...x.cols }
      if (id in c) delete c[id]
      else c[id] = ''
      return { ...x, cols: c }
    })

  return (
    <MutationBoundary>
      <div className="p-5 space-y-7">
        <section>
          <Label>{translate('library:tags', { count: a.tags.length, limit: MAX_TAGS })}</Label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {a.tags.map((t) => (
              <Chip key={t} dim={dimOf(t)} onRemove={() => removeTag(t)}>
                {t}
              </Chip>
            ))}
            <div className="relative">
              <button
                disabled={full}
                title={full ? translate('library:upToTagsPerArticle', { limit: MAX_TAGS }) : undefined}
                onClick={() => setAdding((v) => !v)}
                aria-expanded={adding}
                aria-haspopup="listbox"
                className="h-6 px-2.5 rounded-full border border-dashed border-[#b6bac0] text-[12px] text-g-sub hover:bg-white inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon d={P.plus} className="w-3 h-3" /> {translate('library:add')}
              </button>
              {adding && (
                <div className="absolute z-20 top-8 left-0 w-52 max-h-56 overflow-y-auto scroll-quiet bg-white rounded-xl border border-g-line shadow-[0_8px_24px_rgba(0,0,0,.12)] py-1">
                  {addable.length === 0 && (
                    <p className="px-3.5 h-8 flex items-center text-[12.5px] text-g-sub">
                      {translate('library:noTagsAvailable')}
                    </p>
                  )}
                  {addable.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => addTag(t.name)}
                      className="w-full text-left px-3.5 h-8 text-[13px] hover:bg-g-surface flex justify-between items-center"
                    >
                      {t.name}
                      <span className="text-[12px] text-g-sub">{def(t.dim).label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-[12px] text-g-sub mt-2.5 leading-relaxed">
            {translate('library:removedTagsWillNotBeAddedBackAutomatically')}
            {a.excluded.length > 0 && (
              <span className="block mt-0.5">{translate('library:excluded', { tags: a.excluded.join('、') })}</span>
            )}
          </p>
        </section>

        <section>
          <Label>{translate('app:collectionsHeading')}</Label>
          <div>
            {cols
              .filter((c) => !c.archived)
              .map((c) => {
                const on = c.id in a.cols
                return (
                  <div key={c.id} className="py-1.5">
                    <button
                      onClick={() => toggleCol(c.id)}
                      aria-pressed={on}
                      className="w-full flex items-center gap-2.5 text-left"
                    >
                      <span
                        className={`w-4 h-4 rounded-[4px] border-2 grid place-items-center shrink-0 transition ${on ? 'bg-g-blue border-g-blue text-white' : 'border-[#80868b] bg-white'}`}
                      >
                        {on && <Icon d={P.check} className="w-2.5 h-2.5" />}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colDot(cols, c.id) }} />
                      <span className="text-[13px]">{c.name}</span>
                    </button>
                    {on && (
                      <input
                        value={a.cols[c.id]}
                        onChange={(e) => update(a.id, (x) => ({ ...x, cols: { ...x.cols, [c.id]: e.target.value } }))}
                        placeholder={translate('library:addANote')}
                        className="mt-1 ml-[26px] w-[calc(100%-26px)] h-7 border-b border-g-line text-[12.5px] bg-transparent focus:border-g-blue outline-none"
                      />
                    )}
                  </div>
                )
              })}
          </div>
        </section>

        {a.kind === 'article' && (
          <section>
            <Label>{translate('library:references', { count: a.links.length })}</Label>
            {a.links.length === 0 ? (
              <p className="text-[12.5px] text-g-sub">{translate('library:noExternalReferences')}</p>
            ) : (
              <ol className="border-t border-g-line">
                {a.links.map((l, i) => (
                  <li key={l.url} className="flex gap-2.5 py-2.5 border-b border-g-line">
                    <span className="font-mono text-[12px] text-g-sub pt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] leading-snug text-g-blue">{l.label}</div>
                      <div className="text-[12px] text-g-green mt-0.5 truncate">{l.url}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section>
          <Label>{translate('library:source')}</Label>
          <dl className="text-[12.5px] grid grid-cols-[48px_1fr] gap-y-1.5">
            <dt className="text-g-sub">{translate('library:url')}</dt>
            <dd className="truncate text-g-green">{a.url.replace('https://', '')}</dd>
            {a.kind === 'article' && (
              <>
                <dt className="text-g-sub">{translate('library:language')}</dt>
                <dd>{contentLanguageLabel(a.lang)}</dd>
              </>
            )}
            <dt className="text-g-sub">{translate('library:saved')}</dt>
            <dd>{savedDateLabel(a.date)}</dd>
          </dl>
        </section>
      </div>
    </MutationBoundary>
  )
}
