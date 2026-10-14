import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useState } from 'react'

export function NameField({ name, rename }: { name: string; rename: (to: string) => string | null }) {
  const { t: translate } = useTranslation()

  const [draft, setDraft] = useState(name)
  const [err, setErr] = useState<string | null>(null)
  const commit = () => {
    const e = rename(draft)
    setErr(e)
    if (e) return
    if (!draft.trim()) setDraft(name)
  }
  return (
    <label className="text-[12px] text-g-sub">
      {translate('admin:nameRenamingUpdatesAllReferences')}
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setErr(null)
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-invalid={!!err}
        className={`mt-1 w-full h-10 px-3 rounded-lg border bg-white text-[14px] text-g-text outline-none ${err ? 'border-g-red' : 'border-g-line focus:border-g-blue'}`}
      />
      {err && <span className="block mt-1 text-g-red">{err}</span>}
    </label>
  )
}
