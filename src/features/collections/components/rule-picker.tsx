import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { type Tag } from '@/domain/library'

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
      <div className="flex flex-wrap gap-1.5 mt-3">
        {tags
          .filter((t) => t.enabled || rule.includes(t.name))
          .map((t) => {
            const on = rule.includes(t.name)
            return (
              <button
                key={t.name}
                onClick={() => setRule(on ? rule.filter((r) => r !== t.name) : [...rule, t.name])}
                aria-pressed={on}
                className={`h-7 px-3 rounded-[4px] text-[13px] border transition ${on ? 'bg-g-text border-g-text text-white' : 'border-g-line hover:border-g-mute'}`}
              >
                {t.name}
              </button>
            )
          })}
      </div>
    </>
  )
}
