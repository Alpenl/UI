import { MutationBoundary } from '@/components/ui/mutation-lock'
import { contentLanguageLabel, savedDateLabel } from '@/domain/library'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useState } from 'react'

import { colDot, type Article } from '@/domain/library'

import { TagCloud } from '@/components/domain/tag-cloud'
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
  const [editingTags, setEditingTags] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const addable = tags.filter((t) => t.enabled && !a.tags.includes(t.name))
  const removeTag = (n: string) =>
    update(a.id, (x) => ({ ...x, tags: x.tags.filter((t) => t !== n), excluded: [...x.excluded, n] }))
  const full = a.tags.length >= MAX_TAGS
  const addTag = (n: string) => {
    if (full) return
    update(a.id, (x) => ({ ...x, tags: [...x.tags, n], excluded: x.excluded.filter((e) => e !== n) }))
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
          <TagCloud
            size="sm"
            editing={editingTags}
            onRemove={removeTag}
            items={a.tags.map((t) => ({ id: t, label: t, dim: dimOf(t) }))}
            empty={<p className="text-[12.5px] text-g-mute">{translate('admin:noTagsYet')}</p>}
          />
          <div className="mt-2.5 flex items-center gap-1">
            <button
              disabled={full}
              title={full ? translate('library:upToTagsPerArticle', { limit: MAX_TAGS }) : undefined}
              onClick={() => (setAdding((v) => !v), setEditingTags(false))}
              aria-expanded={adding}
              className={`h-7 px-2.5 rounded-full text-[12px] inline-flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed ${adding ? 'bg-g-text text-white' : 'text-g-blue hover:bg-g-tint'}`}
            >
              <Icon d={adding ? P.x : P.plus} className="w-3 h-3" />
              {adding ? translate('admin:done') : translate('library:add')}
            </button>
            {a.tags.length > 0 && (
              <button
                onClick={() => (setEditingTags((v) => !v), setAdding(false))}
                aria-pressed={editingTags}
                className={`h-7 px-2.5 rounded-full text-[12px] inline-flex items-center gap-1 transition ${editingTags ? 'bg-g-text text-white' : 'text-g-sub hover:bg-g-surface hover:text-g-text'}`}
              >
                <Icon d={editingTags ? P.check : P.edit} className="w-3 h-3" />
                {editingTags ? translate('admin:done') : translate('library:removeTags')}
              </button>
            )}
          </div>
          {adding && (
            <div className="mt-3 rounded-lg border border-g-line bg-white p-3">
              <input
                autoFocus
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder={translate('admin:searchTags')}
                aria-label={translate('admin:searchTags')}
                className="w-full h-8 px-2.5 mb-3 rounded-md bg-g-paper border border-g-line text-[12.5px] outline-none focus:border-g-blue"
              />
              <div className="max-h-56 overflow-y-auto scroll-quiet">
                <TagCloud
                  size="sm"
                  onPick={addTag}
                  items={addable
                    .filter((t) => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase()))
                    .map((t) => ({ id: t.name, label: t.name, dim: t.dim, title: def(t.dim).label }))}
                  empty={<p className="text-[12.5px] text-g-sub">{translate('library:noTagsAvailable')}</p>}
                />
              </div>
            </div>
          )}
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
