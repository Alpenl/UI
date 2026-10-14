import { useState } from 'react'
import type { Collection } from '@/domain/library'
import { useLiveStore } from '@/api/live-store'
import type { StructuralChange, TagScope } from '@/api/tag-structure'
import { Btn } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'
import { StructurePreview } from '@/features/tags/components/structure-preview'

export function RuleEditor({ collection }: { collection: Collection }) {
  const { t } = useAppTranslation()
  const [open, setOpen] = useState(false)
  const { data } = useLiveStore()
  return (
    <div className="mt-3">
      <Btn onClick={() => setOpen(!open)}>{t('admin:editScopeRule')}</Btn>
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
  return (
    <section className="mt-3 rounded-lg border border-g-line p-4 text-[13px] space-y-3">
      <label className="flex gap-2">
        <input type="checkbox" checked={rule.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        {t('admin:ruleEnabled')}
      </label>
      <label className="block">
        {t('admin:ruleMatching')}{' '}
        <select
          value={rule.mode}
          onChange={(e) => patch({ mode: e.target.value as 'any' | 'all' })}
          className="border border-g-line p-2 rounded-lg"
        >
          <option value="any">{t('admin:matchAny')}</option>
          <option value="all">{t('admin:matchAll')}</option>
        </select>
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={rule.admission === 'review'}
          onChange={(e) => patch({ admission: e.target.checked ? 'review' : 'direct' })}
        />
        {t('admin:reviewRequired')}
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={rule.confirmed_only}
          onChange={(e) => patch({ confirmed_only: e.target.checked })}
        />
        {t('admin:confirmedOnly')}
      </label>
      {(['tag_refs', 'exclude_tag_refs'] as const).map((field) => {
        const modeKey = field === 'tag_refs' ? 'tag_modes' : 'exclude_modes'
        const choices = rule[field]
        return (
          <fieldset key={field} className="border-t border-g-line pt-3">
            <legend>{t(field === 'tag_refs' ? 'admin:tagRulesOptional' : 'admin:excludedTags')}</legend>
            {choices.map((value) => (
              <div key={value} className="flex flex-wrap items-center gap-2 py-1">
                <span className="flex-1">{data.tags.find((tag) => tag.ref === value)?.name ?? value}</span>
                <select
                  aria-label={t('admin:conditionScope')}
                  className="border border-g-line rounded-lg p-2"
                  value={change[modeKey]?.[value] ?? 'exact'}
                  onChange={(e) =>
                    setChange((x) => ({ ...x, [modeKey]: { ...x[modeKey], [value]: e.target.value as TagScope } }))
                  }
                >
                  <option value="exact">{t('admin:exactTag')}</option>
                  <option value="with_narrower">{t('admin:withNarrower')}</option>
                </select>
                <Btn
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
                  {t('admin:delete')}
                </Btn>
              </div>
            ))}
            <select
              aria-label={t(field === 'tag_refs' ? 'admin:addPositiveTag' : 'admin:addExcludeTag')}
              value=""
              className="mt-2 border border-g-line rounded-lg p-2 max-w-full"
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
              <option value="">{t('admin:addTag')}</option>
              {data.tags
                .filter(
                  (tag) => tag.enabled && !rule.tag_refs.includes(tag.ref) && !rule.exclude_tag_refs.includes(tag.ref),
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
      <StructurePreview change={change} onSaved={close} />
      <Btn onClick={close}>{t('admin:cancel')}</Btn>
    </section>
  )
}
