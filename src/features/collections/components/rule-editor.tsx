import { useState } from 'react'
import type { Collection } from '@/domain/library'
import { useLiveStore } from '@/api/live-store'
import type { StructuralChange, TagScope } from '@/api/tag-structure'
import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { useAppTranslation } from '@/i18n/use-translation'
import { StructurePreview } from '@/features/tags/components/structure-preview'

export function RuleEditor({ collection }: { collection: Collection }) {
  const { t } = useAppTranslation()
  const [open, setOpen] = useState(false)
  const { data } = useLiveStore()
  return (
    <div className="contents">
      <Btn kind="outline" onClick={() => setOpen(!open)}>
        {t('admin:editScopeRule')}
      </Btn>
      {open && (
        <RuleForm key={data.collectionRevisions[collection.id]} collection={collection} close={() => setOpen(false)} />
      )}
    </div>
  )
}
function RuleForm({ collection: c, close }: { collection: Collection; close: () => void }) {
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
  const toggles = [
    ['admin:ruleEnabled', rule.enabled, (v: boolean) => patch({ enabled: v })],
    [
      'admin:reviewRequired',
      rule.admission === 'review',
      (v: boolean) => patch({ admission: v ? 'review' : 'direct' }),
    ],
    ['admin:confirmedOnly', rule.confirmed_only, (v: boolean) => patch({ confirmed_only: v })],
  ] as const
  const row = 'flex items-center justify-between gap-4 h-11 border-b border-g-line text-[13.5px]'
  return (
    <section className="w-full order-3 pt-2 text-[13px]">
      <div className="max-w-[520px]">
        {toggles.map(([key, on, set]) => (
          <div key={key} className={row}>
            <span>{t(key)}</span>
            <Switch on={on} onChange={set} label={t(key)} />
          </div>
        ))}
        <div className={row} role="group" aria-label={t('admin:ruleMatching')}>
          <span>{t('admin:ruleMatching')}</span>
          <div className="flex rounded-md border border-g-line overflow-hidden text-[12.5px]">
            {(['any', 'all'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={rule.mode === m}
                onClick={() => patch({ mode: m })}
                className={`h-7 px-3.5 transition ${rule.mode === m ? 'bg-g-text text-white font-medium' : 'text-g-sub hover:text-g-text'}`}
              >
                {m === 'any' ? t('admin:matchAny') : t('admin:matchAll')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-x-10 gap-y-6 max-[760px]:grid-cols-1">
        {(['tag_refs', 'exclude_tag_refs'] as const).map((field) => {
          const modeKey = field === 'tag_refs' ? 'tag_modes' : 'exclude_modes'
          const choices = rule[field]
          return (
            <fieldset key={field} className="min-w-0">
              <legend className="w-full flex items-center gap-2 pb-2 mb-1 border-b border-g-line text-[12px] tracking-wide text-g-sub">
                {t(field === 'tag_refs' ? 'admin:tagRulesOptional' : 'admin:excludedTags')}
                <span className="tabular-nums text-g-mute">{choices.length}</span>
              </legend>
              {choices.map((value) => (
                <div key={value} className="flex items-center gap-2 h-10 border-b border-g-line/70">
                  <span className="flex-1 min-w-0 truncate text-[13.5px]">
                    {data.tags.find((tag) => tag.ref === value)?.name ?? value}
                  </span>
                  <select
                    aria-label={t('admin:conditionScope')}
                    className="h-7 pl-2 text-[12px] text-g-sub"
                    value={change[modeKey]?.[value] ?? 'exact'}
                    onChange={(e) =>
                      setChange((x) => ({ ...x, [modeKey]: { ...x[modeKey], [value]: e.target.value as TagScope } }))
                    }
                  >
                    <option value="exact">{t('admin:exactTag')}</option>
                    <option value="with_narrower">{t('admin:withNarrower')}</option>
                  </select>
                  <button
                    type="button"
                    aria-label={t('admin:delete')}
                    title={t('admin:delete')}
                    className="w-7 h-7 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-danger-bg hover:text-g-red transition"
                    onClick={() => {
                      const modes = { ...change[modeKey] }
                      delete modes[value]
                      setChange((x) => ({
                        ...x,
                        [modeKey]: modes,
                        rule: { ...rule, [field]: choices.filter((v) => v !== value) },
                      }))
                    }}
                  >
                    <Icon d={P.x} className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <select
                aria-label={t(field === 'tag_refs' ? 'admin:addPositiveTag' : 'admin:addExcludeTag')}
                value=""
                className="mt-3 h-8 pl-3 text-[13px] text-g-sub w-full"
                onChange={(e) => {
                  const value = e.target.value
                  if (value)
                    setChange((x) => ({
                      ...x,
                      [modeKey]: { ...x[modeKey], [value]: field === 'tag_refs' ? 'with_narrower' : 'exact' },
                      rule: { ...rule, [field]: [...choices, value] },
                    }))
                }}
              >
                <option value="">+ {t('admin:addTag')}</option>
                {data.tags
                  .filter(
                    (tag) =>
                      tag.enabled && !rule.tag_refs.includes(tag.ref) && !rule.exclude_tag_refs.includes(tag.ref),
                  )
                  .map((tag) => (
                    <option key={tag.ref} value={tag.ref}>
                      {tag.name}
                    </option>
                  ))}
              </select>
            </fieldset>
          )
        })}
      </div>
      <StructurePreview change={change} onSaved={close} />
      <div className="mt-2">
        <Btn onClick={close}>{t('admin:cancel')}</Btn>
      </div>
    </section>
  )
}
