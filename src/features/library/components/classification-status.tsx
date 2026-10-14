import type { Article } from '@/domain/library'
import { useAppTranslation } from '@/i18n/use-translation'

const states = [
  'not_started',
  'legacy_unconfirmed',
  'queued',
  'started',
  'completed',
  'failed',
  'uncertain',
  'budget_exhausted',
  'awaiting_source',
  'waiting_reading',
] as const

export function ClassificationStatus({ article }: { article: Article }) {
  const { t } = useAppTranslation()
  const state = states.find((value) => value === article.classificationStatus)
  if (!state) return null
  return (
    <span className="text-[12px] text-g-sub" role="status">
      {t(`library:classificationState_${state}`)}
    </span>
  )
}
