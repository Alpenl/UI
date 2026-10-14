import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { BackendError, operationKey, request } from '@/api/production'
import { liveStore, useLiveStore } from '@/api/live-store'
import { Btn } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'

const base = '/api/tag-system/classification'
const planSchema = z.object({
  plan_token: z.string(),
  article_count: z.number(),
  request_count: z.number(),
  judgment_count: z.number(),
  reserved_tokens: z.number(),
  current_valid_skipped: z.number(),
  ineligible_articles: z.number(),
  daily_request_limit: z.number(),
  daily_requests_remaining: z.number(),
  estimated_cost: z.number().nullable(),
  model: z.string(),
  items: z.array(z.object({ article_id: z.number(), title: z.string(), judgments: z.number() })),
  has_more: z.boolean(),
})
const listSchema = z.object({
  items: z.array(
    z.object({
      run_id: z.string(),
      status: z.string(),
      created_at: z.string(),
      requests: z.number(),
      finished: z.number(),
    }),
  ),
  has_more: z.boolean(),
})
const resultSchema = z.object({
  status: z.string(),
  has_more: z.boolean(),
  items: z.array(
    z.object({
      processing_id: z.string(),
      article_id: z.number(),
      title: z.string(),
      status: z.string(),
      error_code: z.string(),
      request_id: z.string().nullable(),
      request_state: z.string().nullable(),
      outcome: z.string().nullable(),
      model: z.string().nullable(),
      template: z.string().nullable(),
      evaluations: z.array(
        z.object({
          unit: z.string(),
          applied: z.boolean(),
          reason: z.string(),
          revoked: z.boolean(),
          result: z.array(
            z.object({ ref: z.string(), score: z.number().nullable(), selected: z.boolean(), reason: z.string() }),
          ),
        }),
      ),
    }),
  ),
})
type PlanInput = {
  scope: { dimension?: string; tag_refs?: string[]; skip_rejected: boolean }
  related_tags: string[]
  match_names: boolean
  from: string
  to: string
  collections: string[]
  articles: number[]
  include_judged: boolean
}

export function ClassificationRuns({ dimension }: { dimension: string }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const [open, setOpen] = useState(false)
  const [run, setRun] = useState<string>()
  const [page, setPage] = useState(0)
  const list = useQuery({
    queryKey: ['classification-runs', page],
    enabled: open,
    queryFn: ({ signal }) => request(`${base}/runs?offset=${page}`, listSchema, undefined, undefined, signal),
    refetchInterval: open ? 5000 : false,
  })
  return (
    <section className="mt-4 text-[13px]">
      <Btn onClick={() => setOpen(!open)}>{t('admin:classificationRuns')}</Btn>
      {open && (
        <div className="mt-3 rounded-xl border border-g-line p-4 space-y-4">
          {data.classificationRuns && (
            <PlanBuilder
              key={dimension}
              dimension={dimension}
              onStarted={(id) => {
                setRun(id)
                void list.refetch()
              }}
            />
          )}
          <h2 className="font-medium">{t('admin:runHistory')}</h2>
          {list.isPending && <p role="status">{t('common:liveLoading')}</p>}
          {list.error && (
            <p role="alert">
              {t('common:liveLoadError')} <button onClick={() => void list.refetch()}>{t('common:retryRead')}</button>
            </p>
          )}
          {list.data?.items.map((item) => (
            <div key={item.run_id} className="border-t border-g-line py-2">
              <button className="text-g-blue break-all" onClick={() => setRun(item.run_id)}>
                {new Date(item.created_at).toLocaleString()} · {item.finished}/{item.requests} ·{' '}
                {t(
                  item.status === 'revoked'
                    ? 'admin:runRevoked'
                    : item.status === 'cancelled'
                      ? 'admin:runCancelled'
                      : 'admin:runSubmitted',
                )}
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            {page > 0 && <Btn onClick={() => setPage(0)}>{t('admin:firstPage')}</Btn>}
            {list.data?.has_more && <Btn onClick={() => setPage(page + 40)}>{t('admin:nextPage')}</Btn>}
          </div>
          {run && <RunDetail key={run} id={run} close={() => setRun(undefined)} />}
        </div>
      )}
    </section>
  )
}
function PlanBuilder({ dimension, onStarted }: { dimension: string; onStarted: (id: string) => void }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const [target, setTarget] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [collection, setCollection] = useState('')
  const [names, setNames] = useState(true)
  const [related, setRelated] = useState(true)
  const [include, setInclude] = useState(false)
  const [skip, setSkip] = useState(false)
  const tags = data.tags.filter((tag) => tag.dim === dimension)
  const input: PlanInput = {
    scope: { ...(target ? { tag_refs: [target] } : { dimension }), skip_rejected: !target && skip },
    related_tags: related ? (target ? [target] : tags.map((tag) => tag.ref)) : [],
    match_names: names,
    from,
    to,
    collections: collection ? [collection] : [],
    articles: [],
    include_judged: include,
  }
  return (
    <div className="space-y-3">
      <h2 className="font-medium">{t('admin:scopedClassification')}</h2>
      <p className="text-g-sub">{t('admin:scopeUnionHint')}</p>
      <label className="block">
        {t('admin:classificationTarget')}{' '}
        <select
          className="border border-g-line rounded-lg p-2 max-w-full"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">
            {data.dims?.find((d) => d.id === dimension)?.label ?? dimension} · {t('admin:wholeType')}
          </option>
          {tags
            .filter((tag) => tag.enabled && tag.auto)
            .map((tag) => (
              <option key={tag.ref} value={tag.ref}>
                {tag.name}
              </option>
            ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-4">
        <label>
          <input type="checkbox" checked={related} onChange={(e) => setRelated(e.target.checked)} />{' '}
          {t('admin:scopeRelated')}
        </label>
        <label>
          <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> {t('admin:scopeNames')}
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label>
          {t('admin:scopeFrom')}{' '}
          <input
            type="date"
            className="border border-g-line rounded-lg p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {t('admin:scopeTo')}{' '}
          <input
            type="date"
            className="border border-g-line rounded-lg p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          {t('admin:scopeCollection')}{' '}
          <select
            className="border border-g-line rounded-lg p-2 max-w-full"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">{t('admin:noScopeCollection')}</option>
            {data.cols
              .filter((c) => !c.deleted)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="block">
        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />{' '}
        {t('admin:includeJudged')}
      </label>
      {!target && (
        <label className="block">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />{' '}
          {t('admin:skipManualRejected')}
        </label>
      )}
      <PlanConfirmation key={JSON.stringify(input)} input={input} onStarted={onStarted} />
    </div>
  )
}
function PlanConfirmation({ input, onStarted }: { input: PlanInput; onStarted: (id: string) => void }) {
  const { t } = useAppTranslation()
  const [plan, setPlan] = useState<z.infer<typeof planSchema>>()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [submission, setSubmission] = useState(operationKey)
  const preview = async (offset = 0) => {
    setBusy(true)
    setError('')
    try {
      const result = await request(`${base}/plan`, planSchema, { ...input, offset })
      if (offset && plan?.plan_token !== result.plan_token) {
        setPlan(undefined)
        setConfirmed(false)
        setError('plan_stale')
      } else {
        setPlan(result)
        setPage(offset)
      }
    } catch (e) {
      setError(e instanceof BackendError ? e.code : 'network')
    } finally {
      setBusy(false)
    }
  }
  const start = async () => {
    if (!plan || !confirmed) return
    setBusy(true)
    setError('')
    try {
      const result = await request(`${base}/runs`, z.object({ run_id: z.string() }), {
        operation_key: submission,
        submission_key: submission,
        plan_token: plan.plan_token,
        budget_confirmed: true,
        plan: input,
      })
      onStarted(result.run_id)
      setPlan(undefined)
      setConfirmed(false)
      setSubmission(operationKey())
    } catch (e) {
      setError(e instanceof BackendError ? e.code : 'network')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <Btn disabled={busy} onClick={() => void preview()}>
        {t('admin:previewClassificationPlan')}
      </Btn>
      {busy && <p role="status">{t('common:liveLoading')}</p>}
      {error && (
        <p role="alert" className="text-g-red">
          {t(error === 'plan_stale' ? 'admin:planStale' : 'admin:classificationOperationFailed')}
        </p>
      )}
      {plan && (
        <div className="rounded-lg bg-g-surface p-3 space-y-3">
          <p>
            {t('admin:classificationPlanCounts', {
              articles: plan.article_count,
              requests: plan.request_count,
              judgments: plan.judgment_count,
            })}
          </p>
          <p>
            {t('admin:classificationPlanSkipped', {
              valid: plan.current_valid_skipped,
              ineligible: plan.ineligible_articles,
            })}
          </p>
          <p>
            {t('admin:classificationBudget', {
              remaining:
                plan.daily_requests_remaining === -1 ? t('admin:unlimitedCalls') : plan.daily_requests_remaining,
              limit: plan.daily_request_limit === -1 ? t('admin:unlimitedCalls') : plan.daily_request_limit,
              tokens: plan.reserved_tokens,
            })}
          </p>
          <p>
            {t('admin:classificationPriceUnknown')} · {plan.model}
          </p>
          <ul>
            {plan.items.map((item) => (
              <li key={item.article_id} className="break-words">
                {item.title} · {item.judgments}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            {page > 0 && (
              <Btn disabled={busy} onClick={() => void preview(0)}>
                {t('admin:firstPage')}
              </Btn>
            )}
            {plan.has_more && (
              <Btn disabled={busy} onClick={() => void preview(page + 40)}>
                {t('admin:nextPage')}
              </Btn>
            )}
          </div>
          <label className="block">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{' '}
            {t('admin:confirmClassificationBudget')}
          </label>
          <Btn kind="primary" disabled={busy || !confirmed || plan.request_count === 0} onClick={() => void start()}>
            {t('admin:startClassification')}
          </Btn>
        </div>
      )}
    </div>
  )
}
function RunDetail({ id, close }: { id: string; close: () => void }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const [page, setPage] = useState(0)
  const [intent, setIntent] = useState<{ action: string; request_id?: string; key: string }>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [undoResult, setUndoResult] = useState<{ restored_units: number; deleted_units_skipped: number }>()
  const result = useQuery({
    queryKey: ['classification-run', id, page],
    queryFn: ({ signal }) => request(`${base}/runs/${id}?offset=${page}`, resultSchema, undefined, undefined, signal),
    refetchInterval: 5000,
  })
  const command = async () => {
    if (!intent) return
    setBusy(true)
    setFailed(false)
    try {
      const receipt = await request(
        `${base}/runs/${id}/operations`,
        z.object({
          restored_units: z.number().optional(),
          deleted_units_skipped: z.number().optional(),
        }),
        {
          operation_key: intent.key,
          action: intent.action,
          request_id: intent.request_id,
          budget_confirmed: intent.action === 'retry',
        },
      )
      if (intent.action === 'undo' && receipt.restored_units !== undefined) {
        setUndoResult({
          restored_units: receipt.restored_units,
          deleted_units_skipped: receipt.deleted_units_skipped ?? 0,
        })
      }
      setIntent(undefined)
      void result.refetch()
      void liveStore.refresh()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const labels: Record<string, string> = {
    queued: t('admin:runQueued'),
    started: t('admin:runProcessing'),
    completed: t('admin:runCompleted'),
    failed: t('admin:runFailed'),
    uncertain: t('admin:runUnknown'),
    superseded: t('admin:runSuperseded'),
    budget_exhausted: t('admin:runBudgetStopped'),
    applied: t('admin:resultApplied'),
    unapplied: t('admin:resultUnapplied'),
  }
  return (
    <section className="border-t border-g-line pt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Btn onClick={close}>{t('admin:done')}</Btn>
        {result.data?.status === 'running' && (
          <Btn disabled={busy} onClick={() => setIntent({ action: 'cancel', key: operationKey() })}>
            {t('admin:cancelRun')}
          </Btn>
        )}
        {data.classificationRuns && result.data?.status !== 'revoked' && (
          <Btn disabled={busy} onClick={() => setIntent({ action: 'undo', key: operationKey() })}>
            {t('admin:undoRun')}
          </Btn>
        )}
      </div>
      {intent && (
        <div className="rounded-lg border border-g-line p-3 space-y-2">
          <p>
            {t(
              intent.action === 'undo'
                ? 'admin:undoRunConsequences'
                : intent.action === 'retry'
                  ? 'admin:retryRunConsequences'
                  : 'admin:cancelRunConsequences',
            )}
          </p>
          <Btn disabled={busy} kind="primary" onClick={() => void command()}>
            {t('admin:confirmImpact')}
          </Btn>{' '}
          <Btn disabled={busy} onClick={() => setIntent(undefined)}>
            {t('admin:cancel')}
          </Btn>
        </div>
      )}
      {(failed || result.error) && (
        <p role="alert" className="text-g-red">
          {t('admin:classificationOperationFailed')}
        </p>
      )}
      {undoResult && (
        <p role="status">
          {t('admin:undoRunResult', { restored: undoResult.restored_units, skipped: undoResult.deleted_units_skipped })}
        </p>
      )}
      {result.isPending && <p role="status">{t('common:liveLoading')}</p>}
      {result.data?.items.map((item) => (
        <div key={item.processing_id} className="border-t border-g-line py-3 space-y-1">
          <p>
            {item.title} · {labels[item.status] ?? item.status} ·{' '}
            {item.outcome ? (labels[item.outcome] ?? item.outcome) : ''}
          </p>
          {item.error_code && <p className="text-g-sub">{t('admin:runDiagnostic', { code: item.error_code })}</p>}
          {item.evaluations.map((e) => (
            <div key={e.unit} className="pl-3 text-g-sub">
              <p>
                {e.revoked ? t('admin:runRevoked') : e.applied ? t('admin:resultApplied') : t('admin:resultUnapplied')}{' '}
                · {t('admin:runDiagnostic', { code: e.reason })}
              </p>
              {e.result.map((value) => (
                <p key={value.ref}>
                  {data.tags.find((tag) => tag.ref === value.ref)?.name ?? t('admin:deletedHistoricalTag')} ·{' '}
                  {value.score ?? '—'} ·{' '}
                  {value.selected
                    ? t('admin:scoreSelected')
                    : value.reason === 'below_threshold'
                      ? t('admin:scoreBelow')
                      : t('admin:scoreNotSelected')}
                </p>
              ))}
            </div>
          ))}
          {data.classificationRuns &&
            result.data.status === 'running' &&
            item.request_id &&
            (item.request_state === 'unknown_outcome' ||
              (item.request_state === 'settled' && item.outcome !== 'applied')) && (
              <Btn
                disabled={busy}
                onClick={() => setIntent({ action: 'retry', request_id: item.request_id!, key: operationKey() })}
              >
                {t('admin:explicitRetryRun')}
              </Btn>
            )}
        </div>
      ))}
      <div className="flex gap-2">
        {page > 0 && <Btn onClick={() => setPage(0)}>{t('admin:firstPage')}</Btn>}
        {result.data?.has_more && <Btn onClick={() => setPage(page + 40)}>{t('admin:nextPage')}</Btn>}
      </div>
    </section>
  )
}
