import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { type Tag } from '@/domain/library'
import { TagCloud } from '@/components/domain/tag-cloud'

export function RulePicker({
  tags,
  rule,
  mode,
  setRule,
  setMode,
}: {
  tags: Tag[]
  rule: string[]
  mode: 'any' | 'all'
  setRule: (r: string[]) => void
  setMode: (m: 'any' | 'all') => void
}) {
  const { t: translate } = useTranslation()

  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[13px] text-g-sub">{translate('admin:tagRulesOptional')}</span>
        <div
          role="group"
          aria-label={translate('admin:ruleMatching')}
          className="flex rounded-md border border-g-line text-[12px] overflow-hidden"
        >
          {(['any', 'all'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 h-6 ${mode === m ? 'bg-g-text text-white font-medium' : 'text-g-sub'}`}
            >
              {m === 'any' ? translate('admin:matchAny') : translate('admin:matchAll')}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <TagCloud
          size="sm"
          onPick={(name) => setRule(rule.includes(name) ? rule.filter((r) => r !== name) : [...rule, name])}
          items={tags
            .filter((t) => t.enabled || rule.includes(t.name))
            .map((t) => ({
              id: t.name,
              label: t.name,
              dim: t.dim,
              active: rule.includes(t.name),
              muted: rule.length > 0,
            }))}
        />
      </div>
    </>
  )
}
