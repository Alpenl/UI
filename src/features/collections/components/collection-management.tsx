import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { loadMembers, request } from '@/api/production'
import { liveStore, useLiveStore } from '@/api/live-store'
import { KINDS, type Collection } from '@/domain/library'
import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { useAppTranslation } from '@/i18n/use-translation'
import { RuleForm } from './rule-editor'

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
const UP = 'M6 15l6-6 6 6'
const DOWN = 'M6 9l6 6 6-6'

export type DrawerTab = 'rule' | 'members' | 'review'

export function CollectionDrawer({
  collection: c,
  count,
  tab,
  setTab,
  onClose,
}: {
  collection: Collection
  count: number
  tab: DrawerTab
  setTab: (t: DrawerTab) => void
  onClose: () => void
}) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const canEditRule = data.relationsVersion === 1 && data.structureEditable !== false
  const tabs: [DrawerTab, string][] = [
    ...(canEditRule ? ([['rule', t('admin:tabRule')]] as [DrawerTab, string][]) : []),
    ['members', t('admin:tabMembers')],
    ['review', t('admin:pendingReview')],
  ]
  const current = tab === 'rule' && !canEditRule ? 'members' : tab
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 overlay-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[min(560px,100vw)] bg-white border-l border-g-line shadow-[-12px_0_40px_rgba(0,0,0,.10)] flex flex-col outline-none drawer-in">
          <header className="px-7 pt-6 border-b border-g-line">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <Dialog.Title className="font-serif text-[22px] font-medium leading-snug truncate">
                  {c.name}
                </Dialog.Title>
                <Dialog.Description className="text-[12.5px] text-g-sub mt-1">
                  {count} {KINDS[c.kind].unit}
                  {' · '}
                  {c.ruleEnabled ? t('admin:autoCollecting') : t('admin:manualCollection')}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={t('admin:close')}
                className="w-8 h-8 -mr-2 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-surface hover:text-g-text"
              >
                <Icon d={P.x} className="w-[18px] h-[18px]" />
              </Dialog.Close>
            </div>
            <div role="tablist" className="mt-5 flex gap-6 -mb-px">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={current === id}
                  onClick={() => setTab(id)}
                  className={`h-10 text-[13.5px] border-b-2 transition ${current === id ? 'border-g-blue text-g-text font-medium' : 'border-transparent text-g-sub hover:text-g-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto scroll-quiet px-7 py-6 text-[13px]">
            {current === 'rule' && (
              <RuleForm key={data.collectionRevisions[c.id]} collection={c} close={() => setTab('members')} />
            )}
            {current === 'members' && <Members collection={c} />}
            {current === 'review' && <Review collection={c} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const action = (id: string, type: string, data: object = {}) => void liveStore.action(id, type, data)

function Members({ collection: c }: { collection: Collection }) {
  const { t } = useAppTranslation()
  const state = useLiveStore()
  const [cursor, setCursor] = useState<number | undefined>()
  const revision = state.data.collectionRevisions[c.id]
  const page = useQuery({
    queryKey: ['collection-members', c.id, revision, cursor],
    queryFn: ({ signal }) => loadMembers(c.id, state.data.tags, cursor, signal),
  })
  const members = page.data?.items ?? []
  const iconBtn =
    'w-7 h-7 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-surface hover:text-g-text disabled:opacity-30 disabled:pointer-events-none'
  return (
    <div>
      {page.error && <ErrorLine />}
      {page.isPending ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty text={t('admin:noMembers')} />
      ) : (
        <ol className="divide-y divide-g-line border-y border-g-line">
          {members.map((a, i) => (
            <li key={a.id} className="group flex items-center gap-3 py-2.5">
              <span className="w-6 text-right text-[12px] text-g-mute tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">{a.title}</span>
                {a.cols[c.id] && <span className="block truncate text-[12px] text-g-sub">{a.cols[c.id]}</span>}
              </span>
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                <button
                  className={iconBtn}
                  aria-label={t('admin:moveUp')}
                  title={t('admin:moveUp')}
                  disabled={i === 0}
                  onClick={() => action(c.id, 'move', { link_id: a.id, before_id: members[i - 1].id })}
                >
                  <Icon d={UP} className="w-4 h-4" />
                </button>
                <button
                  className={iconBtn}
                  aria-label={t('admin:moveDown')}
                  title={t('admin:moveDown')}
                  disabled={i === members.length - 1 && !page.data?.next_cursor}
                  onClick={() =>
                    action(c.id, 'move', { link_id: a.id, before_id: members[i + 2]?.id ?? page.data?.next_id ?? null })
                  }
                >
                  <Icon d={DOWN} className="w-4 h-4" />
                </button>
                <button
                  className={`${iconBtn} hover:!bg-g-danger-bg hover:!text-g-red`}
                  aria-label={t('admin:removeMember')}
                  title={t('admin:removeMember')}
                  onClick={() => action(c.id, 'remove', { link_ids: [a.id] })}
                >
                  <Icon d={P.x} className="w-4 h-4" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <Pager
        first={cursor ? () => setCursor(undefined) : undefined}
        next={page.data?.next_cursor ? () => setCursor(page.data!.next_cursor!) : undefined}
      />
    </div>
  )
}

function Review({ collection: c }: { collection: Collection }) {
  const { t } = useAppTranslation()
  const state = useLiveStore()
  const [status, setStatus] = useState<'pending' | 'ignored'>('pending')
  const [after, setAfter] = useState<number | undefined>()
  const [preview, setPreview] = useState(false)
  const revision = state.data.collectionRevisions[c.id]
  const candidates = useQuery({
    queryKey: ['collection-candidates', c.id, revision, after, status],
    queryFn: () =>
      request(
        `/api/collections/${c.id}/rules/candidates?status=${status}${after ? `&after=${after}` : ''}`,
        candidatesSchema,
      ),
  })
  const rulePreview = useQuery({
    queryKey: ['collection-preview', c.id, revision],
    enabled: preview,
    queryFn: () => request(`/api/collections/${c.id}/rules/preview`, previewSchema),
  })
  return (
    <div className="space-y-6">
      <section className="rounded-md border border-g-line bg-g-paper/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-[180px] text-[12.5px] text-g-sub leading-relaxed">{t('admin:backfillHint')}</p>
          <Btn kind="outline" onClick={() => setPreview((v) => !v)}>
            {t('admin:previewRule')}
          </Btn>
          <Btn kind="primary" disabled={!c.ruleEnabled || state.dirty} onClick={() => action(c.id, 'backfill')}>
            {t('admin:backfillRule')}
          </Btn>
        </div>
        {preview && rulePreview.data && (
          <div className="mt-4 pt-4 border-t border-g-line">
            <p className="font-medium">
              {t('admin:previewCount', { count: rulePreview.data.counts.would_add })}
              {rulePreview.data.has_more ? '+' : ''}
            </p>
            <ul className="mt-2 space-y-1">
              {rulePreview.data.items.map((x) => (
                <li key={x.id} className="truncate text-g-sub">
                  {x.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {(rulePreview.error || candidates.error) && <ErrorLine />}
      <div>
        <div className="inline-flex gap-0.5 rounded-md border border-g-line bg-white p-0.5 text-[12.5px]">
          {(['pending', 'ignored'] as const).map((s) => (
            <button
              key={s}
              aria-pressed={status === s}
              onClick={() => {
                setStatus(s)
                setAfter(undefined)
              }}
              className={`h-7 px-3.5 rounded-[3px] transition ${status === s ? 'bg-g-text text-white font-medium' : 'text-g-sub hover:text-g-text'}`}
            >
              {s === 'pending' ? t('admin:pendingReview') : t('admin:ignoredCandidates')}
            </button>
          ))}
        </div>
        {candidates.isPending ? (
          <Loading />
        ) : candidates.data?.items.length === 0 ? (
          <Empty text={t('admin:noCandidates')} />
        ) : (
          <ul className="mt-4 divide-y divide-g-line border-y border-g-line">
            {candidates.data?.items.map((x) => (
              <li key={x.link_id} className="flex items-center gap-2 py-2">
                <span className="flex-1 min-w-0 truncate text-[13.5px]">{x.title}</span>
                {status === 'pending' && (
                  <Btn className="h-8 px-3" onClick={() => action(c.id, 'review_ignore', { link_ids: [x.link_id] })}>
                    {t('admin:ignoreCandidate')}
                  </Btn>
                )}
                <Btn
                  kind="outline"
                  className="h-8 px-3"
                  onClick={() => action(c.id, 'review_accept', { link_ids: [x.link_id] })}
                >
                  <Icon d={P.check} className="w-3.5 h-3.5" />
                  {t('admin:acceptCandidate')}
                </Btn>
              </li>
            ))}
          </ul>
        )}
        <Pager
          first={after ? () => setAfter(undefined) : undefined}
          next={candidates.data?.has_more ? () => setAfter(candidates.data?.next_after ?? undefined) : undefined}
        />
      </div>
    </div>
  )
}

function Pager({ first, next }: { first?: () => void; next?: () => void }) {
  const { t } = useAppTranslation()
  if (!first && !next) return null
  return (
    <div className="mt-3 flex justify-end gap-1">
      {first && <Btn onClick={first}>{t('admin:firstPage')}</Btn>}
      {next && <Btn onClick={next}>{t('admin:nextPage')}</Btn>}
    </div>
  )
}
const Loading = () => {
  const { t } = useAppTranslation()
  return <p className="py-10 text-center text-g-sub">{t('common:liveLoading')}</p>
}
const Empty = ({ text }: { text: string }) => <p className="py-12 text-center text-g-sub">{text}</p>
const ErrorLine = () => {
  const { t } = useAppTranslation()
  return (
    <p role="alert" className="mb-3 rounded-md bg-g-danger-bg px-3 py-2 text-g-danger-ink">
      {t('common:liveLoadError')}
    </p>
  )
}
