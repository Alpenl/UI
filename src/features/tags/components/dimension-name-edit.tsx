import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useState } from 'react'

import { Btn } from '@/components/ui/button'

export function DimNameEdit({
  name,
  save,
  cancel,
}: {
  name: string
  save: (v: string) => string | null
  cancel: () => void
}) {
  const { t: translate } = useTranslation()

  const [v, setV] = useState(name)
  const [err, setErr] = useState<string | null>(null)
  const go = () => setErr(save(v))
  return (
    <span className="flex items-center gap-2">
      <input
        autoFocus
        value={v}
        maxLength={12}
        onChange={(e) => (setV(e.target.value), setErr(null))}
        onKeyDown={(e) => (e.key === 'Enter' ? go() : e.key === 'Escape' && cancel())}
        aria-label={translate('admin:typeName')}
        aria-invalid={!!err}
        className={`h-8 w-36 px-3 rounded-[4px] border bg-white text-[13px] outline-none ${err ? 'border-g-red' : 'border-g-blue'}`}
      />
      <Btn kind="primary" onClick={go}>
        {translate('admin:save')}
      </Btn>
      <button onClick={cancel} className="text-g-sub hover:text-g-text">
        {translate('admin:cancel')}
      </button>
      {err && <span className="text-g-red">{err}</span>}
    </span>
  )
}
