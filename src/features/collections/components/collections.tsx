import { liveStore } from '@/api/live-store'
import { CollectionDrawer, type DrawerTab } from './collection-management'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LIVE, operationKey } from '@/api/production'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { KINDS, ruleMatch, type Article, type Collection, type Kind, type Tag } from '@/domain/library'

import { Chip } from '@/components/domain/tag-chip'
import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'

import { RulePicker } from '@/features/collections/components/rule-picker'

export function Collections({
  kind,
  cols,
  setCols,
  arts,
  tags,
  setArts,
  deleteCol,
}: {
  kind: Kind
  cols: Collection[]
  setCols: Dispatch<SetStateAction<Collection[]>>
  arts: Article[]
  tags: Tag[]
  setArts: Dispatch<SetStateAction<Article[]>>
  deleteCol: (id: string) => void
}) {
  const { t: translate } = useTranslation()

  const structured = LIVE && liveStore.getSnapshot().data.relationsVersion === 1
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [rule, setRule] = useState<string[]>([])
  const [mode, setMode] = useState<'any' | 'all'>('any')
  const [scan, setScan] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [managing, setManaging] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('rule')
  const [status, setStatus] = useState<'active' | 'archived' | 'deleted'>('active')
  useEffect(() => {
    if (LIVE) liveStore.setEditing(!!editing)
    return () => {
      if (LIVE) liveStore.setEditing(false)
    }
  }, [editing])

  const patch = (id: string, v: Partial<Collection>) => setCols((x) => x.map((c) => (c.id === id ? { ...c, ...v } : c)))
  // 与侧边栏、筛选使用同一口径：只统计实际归属
  const count = (c: Collection) => c.count ?? arts.filter((a) => c.id in a.cols).length
  const preview = LIVE ? 0 : arts.filter((a) => ruleMatch(rule, mode, a)).length
  const dup = cols.some((c) => c.name === name.trim())

  const create = () => {
    const n = name.trim()
    if (!n || dup) return
    const id = LIVE ? operationKey() : 'c' + Date.now()
    setCols((x) => [
      ...x,
      {
        kind,
        id,
        name: n,
        purpose,
        rule,
        mode,
        pinned: false,
        archived: false,
        ...(LIVE ? { ruleEnabled: rule.length > 0, backfill: scan && rule.length > 0 } : {}),
      },
    ])
    if (!LIVE && scan && rule.length)
      setArts((x) =>
        x.map((a) => (a.kind === kind && ruleMatch(rule, mode, a) ? { ...a, cols: { ...a.cols, [id]: '' } } : a)),
      )
    setName('')
    setPurpose('')
    setRule([])
    setMode('any')
    setScan(true)
    setCreating(false)
  }

  const list = cols
    .filter((c) => (status === 'deleted' ? !!c.deleted : !c.deleted && c.archived === (status === 'archived')))
    .sort((a, b) => +b.pinned - +a.pinned)

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-4xl mx-auto px-8 pt-6 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold leading-tight">
              {translate('app:collectionsByKind', { kind: KINDS[kind].label })}
            </h1>
            <p className="text-[14px] text-g-sub mt-2 max-w-[56ch] leading-relaxed">
              {translate('admin:setAPurposeAndRulesNewlySavedWill', { kind: KINDS[kind].noun })}
            </p>
          </div>
          {!creating && (
            <Btn kind="primary" onClick={() => setCreating(true)}>
              <Icon d={P.plus} className="w-4 h-4" /> {translate('app:newCollection')}
            </Btn>
          )}
        </div>

        {creating && (
          <div className="mt-8 rounded-md border border-g-line bg-white p-7">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={translate('admin:collectionName')}
              aria-label={translate('admin:collectionName')}
              className="w-full h-11 text-[20px] border-b border-g-line focus:border-g-blue outline-none"
            />
            {dup && (
              <p className="text-[12.5px] text-g-red mt-1.5">
                {translate('admin:aCollectionWithThisNameAlreadyExists')}
              </p>
            )}
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              aria-label={translate('admin:purpose')}
              placeholder={translate('admin:purposeAiUsesThisToUnderstandWhatBelongs')}
              className="w-full mt-5 text-[14px] border border-g-line bg-white rounded-md p-3 resize-none focus:border-g-text outline-none transition"
            />
            {!structured && <RulePicker {...{ tags, rule, mode, setRule, setMode }} />}
            {structured && <p className="mt-3 text-[13px] text-g-sub">{translate('admin:configureAfterCreate')}</p>}
            {!structured && (
              <label className="mt-5 flex items-center gap-2 text-[14px]">
                <Switch
                  on={scan}
                  onChange={setScan}
                  label={translate('admin:scanExisting', { kind: KINDS[kind].noun })}
                />
                {translate('admin:scanAndCollectMatching', { kind: KINDS[kind].noun })}
                {scan && rule.length > 0 && (
                  <span className="text-g-sub">
                    {translate('admin:aboutItems', { count: preview, unit: KINDS[kind].unit })}
                  </span>
                )}
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Btn onClick={() => setCreating(false)}>{translate('admin:cancel')}</Btn>
              <Btn kind="primary" onClick={create} disabled={!name.trim() || dup}>
                {translate('admin:create')}
              </Btn>
            </div>
          </div>
        )}

        <div role="tablist" className="mt-8 inline-flex gap-0.5 rounded-md border border-g-line bg-white p-0.5">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              role="tab"
              aria-selected={status === (v ? 'archived' : 'active')}
              onClick={() => {
                setStatus(v ? 'archived' : 'active')
              }}
              className={`h-7 px-4 rounded-[3px] text-[13px] transition ${status === (v ? 'archived' : 'active') ? 'bg-g-text text-white font-medium' : 'text-g-sub hover:text-g-text'}`}
            >
              {v ? translate('admin:archived') : translate('admin:active')}
            </button>
          ))}
          {LIVE && (
            <button
              role="tab"
              aria-selected={status === 'deleted'}
              onClick={() => setStatus('deleted')}
              className={`h-7 px-4 rounded-[3px] text-[13px] transition ${status === 'deleted' ? 'bg-g-text text-white font-medium' : 'text-g-sub hover:text-g-text'}`}
            >
              {translate('admin:deleted')}
            </button>
          )}
        </div>

        <ul className="mt-5 rounded-md border border-g-line bg-white divide-y divide-g-line">
          {list.length === 0 && (
            <li className="py-16 text-center text-[14px] text-g-sub">{translate('admin:noCollectionsHereYet')}</li>
          )}
          {list.map((c) => {
            const isEditing = editing === c.id
            const auto = LIVE ? !!c.ruleEnabled : c.rule.length > 0
            const open = () => LIVE && !c.deleted && !isEditing && setManaging(c.id)
            return (
              <li key={c.id} className="group relative transition hover:bg-g-paper/70">
                <div className="flex items-start gap-4 px-6 py-5">
                  <div
                    className={`flex-1 min-w-0 ${LIVE && !c.deleted && !isEditing ? 'cursor-pointer' : ''}`}
                    onClick={open}
                  >
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={c.name}
                          aria-label={translate('admin:collectionName')}
                          onChange={(e) => patch(c.id, { name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                          className="flex-1 text-[18px] font-medium border-b border-g-blue outline-none bg-transparent"
                        />
                      ) : (
                        <h2 className="font-serif text-[19px] font-medium truncate">{c.name}</h2>
                      )}
                      {c.pinned && <Icon d={P.pin} className="w-4 h-4 text-g-blue shrink-0" />}
                    </div>
                    {isEditing ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={c.purpose}
                          aria-label={translate('admin:purpose')}
                          placeholder={translate('admin:purposeAiUsesThisToUnderstandWhatBelongs')}
                          onChange={(e) => patch(c.id, { purpose: e.target.value })}
                          rows={2}
                          className="w-full text-[14px] border border-g-line bg-white rounded-md p-3 resize-none focus:border-g-blue outline-none"
                        />
                        {!structured && (
                          <RulePicker
                            tags={tags}
                            rule={c.rule}
                            mode={c.mode}
                            setRule={(r) => patch(c.id, { rule: r })}
                            setMode={(m) => patch(c.id, { mode: m })}
                          />
                        )}
                        {LIVE && !structured && (
                          <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
                            <label className="flex items-center gap-2">
                              <Switch
                                on={c.ruleEnabled ?? false}
                                label={translate('admin:ruleEnabled')}
                                onChange={(v) => patch(c.id, { ruleEnabled: v })}
                              />
                              {translate('admin:ruleEnabled')}
                            </label>
                            <label className="flex items-center gap-2">
                              <Switch
                                on={c.admission === 'review'}
                                label={translate('admin:reviewRequired')}
                                onChange={(v) => patch(c.id, { admission: v ? 'review' : 'direct' })}
                              />
                              {translate('admin:reviewRequired')}
                            </label>
                            <label className="flex items-center gap-2">
                              <Switch
                                on={c.confirmedOnly ?? false}
                                label={translate('admin:confirmedOnly')}
                                onChange={(v) => patch(c.id, { confirmedOnly: v })}
                              />
                              {translate('admin:confirmedOnly')}
                            </label>
                            <div className="w-full">
                              <span>{translate('admin:excludedTags')}</span>
                              <RulePicker
                                tags={tags}
                                rule={c.exclude ?? []}
                                mode="any"
                                setRule={(exclude) => patch(c.id, { exclude })}
                                setMode={() => {}}
                              />
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <Btn kind="primary" disabled={LIVE && !c.name.trim()} onClick={() => setEditing(null)}>
                            {translate('admin:done')}
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      c.purpose && (
                        <p className="text-[14px] text-g-sub mt-1.5 leading-relaxed line-clamp-2">{c.purpose}</p>
                      )
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[12.5px] text-g-sub">
                      <span className="tabular-nums text-g-ink">
                        {count(c)} {KINDS[kind].unit}
                      </span>
                      <span className="w-px h-3 bg-g-line" aria-hidden="true" />
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={`w-1.5 h-1.5 rounded-full ${c.archived ? 'bg-g-mute' : auto ? 'bg-g-ok' : 'bg-g-line'}`}
                        />
                        {c.archived
                          ? translate('admin:automaticCollectionPaused')
                          : auto
                            ? translate('admin:autoCollecting')
                            : translate(LIVE ? 'admin:manualCollection' : 'admin:aiSemanticMatchingNoFixedRules')}
                      </span>
                      {c.rule.length > 0 && (
                        <>
                          <span className="w-px h-3 bg-g-line" aria-hidden="true" />
                          <span>{c.mode === 'any' ? translate('admin:matchAny') : translate('admin:matchAll')}</span>
                          {c.rule.slice(0, 4).map((r) => (
                            <Chip key={r} dim={tags.find((t) => t.name === r)?.dim ?? 'topic'}>
                              {r}
                            </Chip>
                          ))}
                          {c.rule.length > 4 && <span className="tabular-nums">+{c.rule.length - 4}</span>}
                        </>
                      )}
                      {LIVE && c.admission === 'review' && (
                        <>
                          <span className="w-px h-3 bg-g-line" aria-hidden="true" />
                          <span>{translate('admin:reviewRequired')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {c.deleted ? (
                    <Btn kind="outline" onClick={() => patch(c.id, { deleted: false })}>
                      {translate('admin:restore')}
                    </Btn>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                        {(
                          [
                            [
                              P.pin,
                              c.pinned ? translate('admin:unpin') : translate('admin:pin'),
                              () => patch(c.id, { pinned: !c.pinned }),
                            ],
                            [
                              P.edit,
                              translate('admin:renameEditDescription'),
                              () => setEditing(isEditing ? null : c.id),
                            ],
                            [
                              P.archive,
                              c.archived ? translate('admin:unarchive') : translate('admin:archive'),
                              () => patch(c.id, { archived: !c.archived }),
                            ],
                          ] as const
                        ).map(([d, t, f]) => (
                          <button
                            key={t}
                            title={t}
                            aria-label={t}
                            onClick={f}
                            className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-surface hover:text-g-text"
                          >
                            <Icon d={d} className="w-[18px] h-[18px]" />
                          </button>
                        ))}
                        <ConfirmDialog
                          title={translate('admin:deleteCollectionKeepContent')}
                          body={translate('admin:itemsWillLeaveThisCollection', {
                            count: count(c),
                            unit: KINDS[kind].unit,
                          })}
                          confirmLabel={translate('admin:confirmDeletion')}
                          onConfirm={() => deleteCol(c.id)}
                          trigger={
                            <button
                              title={translate('admin:deleteCollectionKeepContent')}
                              aria-label={translate('admin:deleteCollectionKeepContent')}
                              className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-danger-bg hover:text-g-red"
                            >
                              <Icon d={P.trash} className="w-[18px] h-[18px]" />
                            </button>
                          }
                        />
                      </div>
                      {LIVE && !isEditing && (
                        <Btn kind="outline" className="ml-2 h-8 px-3" onClick={() => setManaging(c.id)}>
                          {translate('admin:manage')}
                          <Icon d="M9 6l6 6-6 6" className="w-3.5 h-3.5 -mr-1 text-g-mute" />
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {managing && cols.find((c) => c.id === managing) && (
          <CollectionDrawer
            collection={cols.find((c) => c.id === managing)!}
            count={count(cols.find((c) => c.id === managing)!)}
            tab={drawerTab}
            setTab={setDrawerTab}
            onClose={() => setManaging(null)}
          />
        )}
        <p className="text-[12px] text-g-sub mt-6 text-center">
          {translate('admin:deletingACollectionRemovesMembershipOnlySavedContent')}
        </p>
      </div>
    </div>
  )
}
