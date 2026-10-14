import { RuleEditor } from './rule-editor'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { loadMembers, request } from '@/api/production'
import { liveStore, useLiveStore } from '@/api/live-store'
import type { Article, Collection } from '@/domain/library'
import { Btn } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'

const previewSchema = z.object({
  revision: z.number(),
  counts: z.object({ would_add: z.number() }),
  items: z.array(z.object({ id: z.number(), title: z.string() })),
  has_more: z.boolean(),
})
const candidatesSchema = z.object({
  items: z.array(z.object({ link_id: z.number(), title: z.string() })),
  has_more: z.boolean(),
  next_after: z.number().nullable(),
})
export function CollectionManagement({ collection: c }: { collection: Collection; articles: Article[] }) {
  const { t } = useAppTranslation()
  const state = useLiveStore()
  const [open, setOpen] = useState(false)
  const [memberCursor, setMemberCursor] = useState<number | undefined>()
  const [preview, setPreview] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'ignored'>('pending')
  const [after, setAfter] = useState<number | undefined>()
  const revision = state.data.collectionRevisions[c.id]
  const candidates = useQuery({
    queryKey: ['collection-candidates', c.id, revision, after, reviewStatus],
    enabled: open,
    queryFn: () =>
      request(
        `/api/collections/${c.id}/rules/candidates?status=${reviewStatus}${after ? `&after=${after}` : ''}`,
        candidatesSchema,
      ),
  })
  const rulePreview = useQuery({
    queryKey: ['collection-preview', c.id, revision],
    enabled: open && preview,
    queryFn: () => request(`/api/collections/${c.id}/rules/preview`, previewSchema),
  })
  const memberPage = useQuery({
    queryKey: ['collection-members', c.id, revision, memberCursor],
    enabled: open,
    queryFn: ({ signal }) => loadMembers(c.id, state.data.tags, memberCursor, signal),
  })
  const members = memberPage.data?.items ?? []
  const action = (type: string, data: object = {}) => void liveStore.action(c.id, type, data)
  return (
    <div className="mt-4 pt-4 border-t border-g-line text-[13px] flex flex-wrap items-center gap-2">
      {state.data.relationsVersion === 1 && state.data.structureEditable !== false && <RuleEditor collection={c} />}
      <button
        className="h-9 px-3.5 rounded-[4px] text-[13px] font-medium text-g-blue hover:bg-g-tint transition"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t('admin:members')}
      </button>
      {open && (
        <div className="w-full order-3 pt-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setPreview((v) => !v)}>{t('admin:previewRule')}</Btn>
            <Btn disabled={!c.ruleEnabled || state.dirty} onClick={() => action('backfill')}>
              {t('admin:backfillRule')}
            </Btn>
          </div>
          {(rulePreview.error || candidates.error || memberPage.error) && (
            <p role="alert" className="text-g-red">
              {t('common:liveLoadError')}
            </p>
          )}
          {preview && rulePreview.data && (
            <div>
              <p>
                {t('admin:previewCount', { count: rulePreview.data.counts.would_add })}
                {rulePreview.data.has_more ? ' +' : ''}
              </p>
              <ul>
                {rulePreview.data.items.map((x) => (
                  <li key={x.id} className="truncate text-g-sub">
                    {x.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="flex gap-3">
              <button
                className="text-g-blue"
                onClick={() => {
                  setReviewStatus('pending')
                  setAfter(undefined)
                }}
              >
                {t('admin:pendingReview')}
              </button>
              <button
                className="text-g-blue"
                onClick={() => {
                  setReviewStatus('ignored')
                  setAfter(undefined)
                }}
              >
                {t('admin:ignoredCandidates')}
              </button>
            </div>
            {candidates.isPending ? (
              <p>{t('common:liveLoading')}</p>
            ) : candidates.data?.items.length === 0 ? (
              <p className="text-g-sub">{t('admin:noCandidates')}</p>
            ) : null}
            {candidates.data?.items.map((x) => (
              <div key={x.link_id} className="flex items-center gap-2 border-b border-g-line py-2">
                <span className="flex-1 truncate">{x.title}</span>
                <Btn onClick={() => action('review_accept', { link_ids: [x.link_id] })}>
                  {t('admin:acceptCandidate')}
                </Btn>
                <Btn
                  disabled={reviewStatus === 'ignored'}
                  onClick={() => action('review_ignore', { link_ids: [x.link_id] })}
                >
                  {t('admin:ignoreCandidate')}
                </Btn>
              </div>
            ))}
            {after && <Btn onClick={() => setAfter(undefined)}>{t('admin:firstPage')}</Btn>}
            {candidates.data?.has_more && (
              <Btn onClick={() => setAfter(candidates.data?.next_after ?? undefined)}>{t('admin:nextPage')}</Btn>
            )}
          </div>
          {memberPage.isPending && <p>{t('common:liveLoading')}</p>}
          <ul>
            {members.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 border-t border-g-line py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.title}</span>
                  {a.cols[c.id] && <span className="text-g-sub">{a.cols[c.id]}</span>}
                </span>
                <Btn disabled={i === 0} onClick={() => action('move', { link_id: a.id, before_id: members[i - 1].id })}>
                  {t('admin:moveUp')}
                </Btn>
                <Btn
                  disabled={i === members.length - 1 && !memberPage.data?.next_cursor}
                  onClick={() =>
                    action('move', { link_id: a.id, before_id: members[i + 2]?.id ?? memberPage.data?.next_id ?? null })
                  }
                >
                  {t('admin:moveDown')}
                </Btn>
                <Btn onClick={() => action('remove', { link_ids: [a.id] })}>{t('admin:removeMember')}</Btn>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            {memberCursor && <Btn onClick={() => setMemberCursor(undefined)}>{t('admin:firstPage')}</Btn>}
            {memberPage.data?.next_cursor && (
              <Btn onClick={() => setMemberCursor(memberPage.data!.next_cursor!)}>{t('admin:nextPage')}</Btn>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
