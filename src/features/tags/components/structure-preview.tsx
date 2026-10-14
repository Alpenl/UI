import { useEffect, useRef, useState } from 'react'
import { BackendError, clearOperationJournal, operationKey } from '@/api/production'
import { commitStructure, previewStructure, type Impact, type StructuralChange } from '@/api/tag-structure'
import { liveStore, useLiveStore } from '@/api/live-store'
import { Btn } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'

// Key the child by the exact proposed change. Editing it invalidates the preview
// and aborts reads, while a timed-out commit retains its operation identity.
export function StructurePreview({ change, onSaved }: { change: StructuralChange; onSaved: () => void }) {
  return <Preview key={JSON.stringify(change)} change={change} onSaved={onSaved} />
}
function Preview({ change, onSaved }: { change: StructuralChange; onSaved: () => void }) {
  const { t } = useAppTranslation()
  const state = useLiveStore()
  const [impact, setImpact] = useState<Impact>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const key = useRef(operationKey())
  useEffect(() => () => controller.current?.abort(), [])
  const preview = async (page = 0) => {
    controller.current?.abort()
    const c = new AbortController()
    controller.current = c
    setBusy(true)
    setError('')
    try {
      const result = await previewStructure(change, page, c.signal)
      if (c.signal.aborted) return
      if (page && impact && result.preview_token !== impact.preview_token) {
        setImpact(undefined)
        setOffset(0)
        setError('preview_stale')
        return
      }
      setImpact(result)
      setOffset(page)
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof BackendError ? e.code : 'network')
    } finally {
      if (!c.signal.aborted) setBusy(false)
    }
  }
  const commit = async () => {
    if (!impact || state.dirty || state.saving) return
    setBusy(true)
    setError('')
    try {
      await commitStructure(change, impact.preview_token, key.current)
      clearOperationJournal()
      onSaved()
      void liveStore.refresh()
    } catch (e) {
      setError(e instanceof BackendError ? e.code : 'network')
      if (e instanceof BackendError && e.status === 409) {
        setImpact(undefined)
        key.current = operationKey()
      }
    } finally {
      setBusy(false)
    }
  }
  const labels = {
    member_add: t('admin:impactMemberAdd'),
    member_remove: t('admin:impactMemberRemove'),
    pending_add: t('admin:impactPendingAdd'),
    pending_remove: t('admin:impactPendingRemove'),
    manual_retained: t('admin:impactManualRetained'),
    manual_blocked: t('admin:impactManualBlocked'),
    ignored_preserved: t('admin:impactIgnored'),
    accepted_preserved: t('admin:impactAccepted'),
  }
  return (
    <div className="mt-4 space-y-3 text-[13px]">
      {(state.dirty || state.saving) && <p>{t('admin:saveDraftFirst')}</p>}
      <Btn disabled={busy || state.dirty || state.saving} onClick={() => void preview()}>
        {t('admin:previewImpact')}
      </Btn>
      {busy && <p role="status">{t('common:liveLoading')}</p>}
      {error && (
        <p role="alert" className="text-g-red">
          {t(
            error === 'relation_cycle'
              ? 'admin:relationCycle'
              : error === 'preview_stale' || error === 'revision_conflict'
                ? 'admin:previewStale'
                : 'admin:structureFailed',
          )}
        </p>
      )}
      {impact && (
        <div className="rounded-lg border border-g-line p-3 space-y-3">
          <p>
            {t('admin:impactMembers', {
              before: impact.counts.members_before ?? 0,
              after: impact.counts.members_after ?? 0,
            })}
          </p>
          <dl className="grid grid-cols-2 gap-2">
            {Object.entries(labels).map(([reason, label]) => (
              <div key={reason}>
                <dt>{label}</dt>
                <dd>{impact.counts[reason] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <ul>
            {impact.items.map((item) => (
              <li
                key={`${item.collection_id}/${item.article_id}/${item.reason}`}
                className="py-1 border-t border-g-line break-words"
              >
                {item.title} · {labels[item.reason as keyof typeof labels]} ·{' '}
                {state.data.cols.find((c) => c.id === item.collection_id)?.name ?? item.collection_id}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {offset > 0 && (
              <Btn disabled={busy} onClick={() => void preview(0)}>
                {t('admin:firstPage')}
              </Btn>
            )}
            {impact.has_more && (
              <Btn disabled={busy} onClick={() => void preview(offset + 40)}>
                {t('admin:nextPage')}
              </Btn>
            )}
            <Btn kind="primary" disabled={busy || state.dirty || state.saving} onClick={() => void commit()}>
              {t('admin:confirmImpact')}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
