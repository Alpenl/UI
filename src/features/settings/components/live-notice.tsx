import { DESIGN, DESIGN_DATE, LIVE } from '@/api/production-mode'
import { liveStore, type useLiveStore } from '@/api/live-store'
import { useAppTranslation } from '@/i18n/use-translation'
export function LiveNotice({ state }: { state: ReturnType<typeof useLiveStore> }) {
  const { t } = useAppTranslation()
  if (!LIVE) return null
  const keys = {
    load: 'common:liveLoadError',
    save: 'common:liveSaveError',
    conflict: 'common:liveConflict',
    unsupported: 'common:liveUnsupported',
    validation: 'common:liveValidationError',
    rejected: 'common:liveRejected',
  } as const
  const errorKeys = {
    invalid_tag_definition: 'common:errorInvalidTag',
    system_dimension_fixed: 'common:errorFixedDimension',
    last_ai_tag: 'common:errorLastAiTag',
    design_read_only: 'common:designReadOnly',
    classification_change_required: 'common:errorClassificationChange',
    invalid_ai_label: 'common:errorAILabel',
    tag_collision: 'common:errorTagCollision',
    system_tag_exists: 'common:errorTagCollision',
    custom_tag_exists: 'common:errorTagCollision',
    invalid_rule: 'common:errorInvalidRule',
  } as const
  const detail = errorKeys[state.errorCode as keyof typeof errorKeys]
  return (
    <div
      role={state.error ? 'alert' : 'status'}
      className="shrink-0 px-6 py-2 border-b border-g-line text-[12px] text-g-sub flex items-center gap-3"
    >
      <span>
        {state.error
          ? t(keys[state.error])
          : state.saving
            ? t(state.reloadingAfterSave ? 'common:liveSavedUpdating' : 'common:liveSaving')
            : state.dirty
              ? t('common:liveUnsaved')
              : !state.data.server && state.loading
                ? t('common:liveLoading')
                : state.fetching || state.readingFetching
                  ? t('common:liveUpdating')
                  : DESIGN
                    ? t('common:designSnapshot', { date: DESIGN_DATE })
                    : t('common:liveConnected')}
      </span>
      {state.error && detail && <span>{t(detail)}</span>}
      {state.dirty && !state.saving && (
        <>
          <button className="text-g-blue" onClick={() => void liveStore.flush()}>
            {t('common:retrySave')}
          </button>
          <button className="text-g-blue" onClick={() => void liveStore.discard()}>
            {t('common:discardDraft')}
          </button>
        </>
      )}
      <button
        className="ml-auto text-g-blue shrink-0"
        disabled={state.loading || state.fetching || state.readingFetching || state.saving || state.dirty}
        onClick={() => {
          void liveStore.refresh()
        }}
      >
        {t('common:liveRefresh')}
      </button>
    </div>
  )
}
