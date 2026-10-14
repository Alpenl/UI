import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { KINDS, type Kind } from '@/domain/library'

import type { Hit } from '@/features/library/types'

export function OtherHits({ hits, jump }: { hits: Hit[]; jump: (k: Kind) => void }) {
  const { t: translate } = useTranslation()

  if (!hits.length) return null
  return (
    <div className="px-4 py-2.5 bg-g-tint/60 border-b border-g-line text-[12.5px] flex flex-wrap gap-x-3 gap-y-1">
      <span className="text-g-sub">{translate('library:alsoFoundInOtherTypes')}</span>
      {hits.map((h) => (
        <button key={h.kind} onClick={() => jump(h.kind)} className="text-g-blue-dark font-medium hover:underline">
          {KINDS[h.kind].label} {h.n} {KINDS[h.kind].unit} →
        </button>
      ))}
    </div>
  )
}
