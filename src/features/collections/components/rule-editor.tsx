import { useState } from 'react'
import { TagCloud } from '@/components/domain/tag-cloud'
import type { Collection } from '@/domain/library'
import { useLiveStore } from '@/api/live-store'
import type { StructuralChange, TagScope } from '@/api/tag-structure'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { useAppTranslation } from '@/i18n/use-translation'
import { StructurePreview } from '@/features/tags/components/structure-preview'

type Field = 'tag_refs' | 'exclude_tag_refs'

export function RuleForm({ collection: c, close }: { collection: Collection; close: () => void }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const ref = (name: string) => data.tags.find((tag) => tag.name === name)?.ref ?? name
  const [change, setChange] = useState<StructuralChange>({
    kind: 'rule',
    collection_id: c.id,
    rule: {
      expected_revision: data.collectionRevisions[c.id],
      enabled: c.ruleEnabled ?? false,
      mode: c.mode,
      tag_refs: c.rule.map(ref),
      exclude_tag_refs: (c.exclude ?? []).map(ref),
      admission: c.admission ?? 'direct',
      confirmed_only: c.confirmedOnly ?? false,
    },
    tag_modes: c.ruleTagModes ?? {},
    exclude_modes: c.ruleExcludeModes ?? {},
  })
  const rule = change.rule!
  const patch = (values: Partial<typeof rule>) => setChange((x) => ({ ...x, rule: { ...x.rule!, ...values } }))
  const used = new Set([...rule.tag_refs, ...rule.exclude_tag_refs])
  const available = data.tags.filter((tag) => tag.enabled && !used.has(tag.ref))

  const add = (field: Field, value: string) => {
    const modeKey = field === 'tag_refs' ? 'tag_modes' : 'exclude_modes'
    setChange((x) => ({
      ...x,
      [modeKey]: { ...x[modeKey], [value]: field === 'tag_refs' ? 'with_narrower' : 'exact' },
      rule: { ...x.rule!, [field]: [...x.rule![field], value] },
    }))
  }
  const remove = (field: Field, value: string) => {
    const modeKey = field === 'tag_refs' ? 'tag_modes' : 'exclude_modes'
    setChange((x) => {
      const modes = { ...x[modeKey] }
      delete modes[value]
      return { ...x, [modeKey]: modes, rule: { ...x.rule!, [field]: x.rule![field].filter((v) => v !== value) } }
    })
  }

  const disabled = !rule.enabled
  return (
    <div className="space-y-8">
      <section className="rounded-md border border-g-line bg-g-paper/60 p-4 flex items-start gap-4">
        <div className="flex-1">
          <p className="text-[14px] font-medium">{t('admin:ruleEnabled')}</p>
          <p className="text-[12.5px] text-g-sub mt-1 leading-relaxed">{t('admin:ruleEnabledHint')}</p>
        </div>
        <Switch on={rule.enabled} onChange={(v) => patch({ enabled: v })} label={t('admin:ruleEnabled')} />
      </section>

      <div className={`space-y-8 transition ${disabled ? 'opacity-50' : ''}`}>
        <section>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[12px] tracking-wide text-g-sub">{t('admin:tagRulesOptional')}</h3>
            <div
              role="group"
              aria-label={t('admin:ruleMatching')}
              className="inline-flex gap-0.5 rounded-md border border-g-line bg-white p-0.5 text-[12px]"
            >
              {(['any', 'all'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={rule.mode === m}
                  onClick={() => patch({ mode: m })}
                  className={`h-6 px-3 rounded-[3px] transition ${rule.mode === m ? 'bg-g-text text-white font-medium' : 'text-g-sub hover:text-g-text'}`}
                >
                  {m === 'any' ? t('admin:matchAny') : t('admin:matchAll')}
                </button>
              ))}
            </div>
          </div>
          <TagField
            field="tag_refs"
            values={rule.tag_refs}
            modes={change.tag_modes ?? {}}
            tags={data.tags as { ref: string; name: string; dim: string }[]}
            available={available as { ref: string; name: string; dim: string }[]}
            onAdd={add}
            onRemove={remove}
            onMode={(v, m) => setChange((x) => ({ ...x, tag_modes: { ...x.tag_modes, [v]: m } }))}
          />
        </section>

        <section>
          <h3 className="text-[12px] tracking-wide text-g-sub">{t('admin:excludedTags')}</h3>
          <TagField
            field="exclude_tag_refs"
            values={rule.exclude_tag_refs}
            modes={change.exclude_modes ?? {}}
            tags={data.tags as { ref: string; name: string; dim: string }[]}
            available={available as { ref: string; name: string; dim: string }[]}
            onAdd={add}
            onRemove={remove}
            onMode={(v, m) => setChange((x) => ({ ...x, exclude_modes: { ...x.exclude_modes, [v]: m } }))}
          />
        </section>

        <section className="divide-y divide-g-line border-y border-g-line">
          {(
            [
              [
                'admin:reviewRequired',
                'admin:reviewRequiredHint',
                rule.admission === 'review',
                (v: boolean) => patch({ admission: v ? 'review' : 'direct' }),
              ],
              [
                'admin:confirmedOnly',
                'admin:confirmedOnlyHint',
                rule.confirmed_only,
                (v: boolean) => patch({ confirmed_only: v }),
              ],
            ] as const
          ).map(([key, hint, on, set]) => (
            <div key={key} className="flex items-start gap-4 py-3.5">
              <div className="flex-1">
                <p className="text-[13.5px]">{t(key)}</p>
                <p className="text-[12px] text-g-sub mt-0.5">{t(hint)}</p>
              </div>
              <Switch on={on} onChange={set} label={t(key)} />
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-md border border-g-line p-4">
        <h3 className="text-[12px] tracking-wide text-g-sub">{t('admin:impactSection')}</h3>
        <p className="text-[12.5px] text-g-sub mt-1">{t('admin:impactSectionHint')}</p>
        <StructurePreview change={change} onSaved={close} />
      </section>
    </div>
  )
}

function TagField({
  field,
  values,
  tags,
  available,
  onAdd,
  onRemove,
}: {
  field: Field
  values: string[]
  modes: Record<string, TagScope>
  tags: { ref: string; name: string; dim: string }[]
  available: { ref: string; name: string; dim: string }[]
  onAdd: (f: Field, v: string) => void
  onRemove: (f: Field, v: string) => void
  onMode: (v: string, m: TagScope) => void
}) {
  const { t } = useAppTranslation()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState('')
  if (editing && !values.length) setEditing(false)
  const find = (v: string) => tags.find((tag) => tag.ref === v)
  const chipBtn = (on: boolean) =>
    `h-7 px-2.5 rounded-full text-[12px] inline-flex items-center gap-1 transition ${on ? 'bg-g-text text-white' : 'text-g-blue hover:bg-g-tint'}`
  return (
    <div className="mt-3">
      <TagCloud
        editing={editing}
        onRemove={(v) => onRemove(field, v)}
        empty={<p className="text-[13px] text-g-mute">{t('admin:noTagsYet')}</p>}
        items={values.map((value) => {
          return {
            id: value,
            label: find(value)?.name ?? value,
            dim: find(value)?.dim ?? 'topic',
          }
        })}
      />
      <div className="mt-2.5 flex items-center gap-1">
        <button type="button" onClick={() => (setAdding((v) => !v), setEditing(false))} className={chipBtn(adding)}>
          <Icon d={adding ? P.check : P.plus} className="w-3 h-3" />
          {adding ? t('admin:done') : t(field === 'tag_refs' ? 'admin:addPositiveTag' : 'admin:addExcludeTag')}
        </button>
        {values.length > 0 && (
          <button
            type="button"
            onClick={() => (setEditing((v) => !v), setAdding(false))}
            className={`${chipBtn(editing)} ${editing ? '' : '!text-g-sub hover:!bg-g-surface'}`}
          >
            <Icon d={editing ? P.check : P.edit} className="w-3 h-3" />
            {editing ? t('admin:done') : t('library:removeTags')}
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-3 rounded-lg border border-g-line bg-g-paper/60 p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin:searchTags')}
            aria-label={t('admin:searchTags')}
            className="w-full h-8 px-2.5 mb-3 rounded-md bg-white border border-g-line text-[12.5px] outline-none focus:border-g-blue"
          />
          <div className="max-h-64 overflow-y-auto scroll-quiet">
            <TagCloud
              size="sm"
              onPick={(v) => onAdd(field, v)}
              empty={<p className="text-[12.5px] text-g-sub">{t('admin:noMatchingTags')}</p>}
              items={available
                .filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))
                .map((o) => ({ id: o.ref, label: o.name, dim: o.dim }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}
