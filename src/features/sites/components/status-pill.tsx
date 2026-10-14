import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { type Article } from '@/domain/library'

export function StatusPill({ a }: { a: Article }) {
  const { t: translate } = useTranslation()

  if (a.failed)
    return (
      <span className="h-5 px-2 rounded-full bg-g-warn-bg text-g-warn-ink text-[12px] font-medium inline-flex items-center shrink-0">
        {translate('library:incomplete')}
      </span>
    )
  if (a.site?.status === 'dead')
    return (
      <span className="h-5 px-2 rounded-full bg-g-danger-bg text-g-red text-[12px] font-medium inline-flex items-center shrink-0">
        {translate('sites:brokenLink')}
      </span>
    )
  return null
}
