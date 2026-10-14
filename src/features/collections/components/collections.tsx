import { liveStore } from '@/api/live-store'
import { CollectionManagement } from './collection-management'
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
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
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
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-normal">
              {translate('app:collectionsByKind', { kind: KINDS[kind].label })}
            </h1>
            <p className="text-[14px] text-g-sub mt-1">
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
          <div className="mt-6 rounded-2xl border border-g-line p-6 shadow-[0_1px_3px_rgba(60,64,67,.15)]">
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
              className="w-full mt-4 text-[14px] border border-g-line rounded-xl p-3 resize-none focus:border-g-blue outline-none"
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

        <div role="tablist" className="mt-8 flex gap-1 border-b border-g-line">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              role="tab"
              aria-selected={status === (v ? 'archived' : 'active')}
              onClick={() => {
                setStatus(v ? 'archived' : 'active')
              }}
              className={`h-10 px-4 text-[14px] font-medium border-b-2 -mb-px ${status === (v ? 'archived' : 'active') ? 'border-g-blue text-g-blue-dark' : 'border-transparent text-g-sub'}`}
            >
              {v ? translate('admin:archived') : translate('admin:active')}
            </button>
          ))}
          {LIVE && (
            <button
              role="tab"
              aria-selected={status === 'deleted'}
              onClick={() => setStatus('deleted')}
              className={`h-10 px-4 text-[14px] border-b-2 ${status === 'deleted' ? 'border-g-blue text-g-blue-dark' : 'border-transparent text-g-sub'}`}
            >
              {translate('admin:deleted')}
            </button>
          )}
        </div>

        <ul className="divide-y divide-g-line">
          {list.length === 0 && (
            <li className="py-12 text-center text-[14px] text-g-sub">{translate('admin:noCollectionsHereYet')}</li>
          )}
          {list.map((c) => {
            const isEditing = editing === c.id
            return (
              <li key={c.id} className="py-5 group">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={c.name}
                          aria-label={translate('admin:collectionName')}
                          onChange={(e) => patch(c.id, { name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                          className="text-[18px] font-medium border-b border-g-blue outline-none"
                        />
                      ) : (
                        <h2 className="text-[18px] font-medium">{c.name}</h2>
                      )}
                      {c.pinned && <Icon d={P.pin} className="w-4 h-4 text-g-blue" />}
                      <span className="text-[13px] text-g-sub">
                        {count(c)} {KINDS[kind].unit}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="mt-1">
                        <textarea
                          value={c.purpose}
                          aria-label={translate('admin:purpose')}
                          onChange={(e) => patch(c.id, { purpose: e.target.value })}
                          rows={2}
                          className="w-full text-[14px] border border-g-line rounded-lg p-2 resize-none focus:border-g-blue outline-none"
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
                        <div className="mt-1.5">
                          <Btn disabled={LIVE && !c.name.trim()} onClick={() => setEditing(null)}>
                            {translate('admin:done')}
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[14px] text-g-sub mt-1 leading-relaxed">{c.purpose}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {c.rule.length > 0 ? (
                        <>
                          <span className="text-[12px] text-g-sub mr-1">
                            {c.mode === 'any' ? translate('admin:matchAny') : translate('admin:matchAll')}
                          </span>
                          {c.rule.map((r) => (
                            <Chip key={r} dim={tags.find((t) => t.name === r)?.dim ?? 'topic'}>
                              {r}
                            </Chip>
                          ))}
                        </>
                      ) : (
                        <span className="text-[12px] text-g-sub">
                          {translate(LIVE ? 'admin:manualCollection' : 'admin:aiSemanticMatchingNoFixedRules')}
                        </span>
                      )}
                      {c.archived && (
                        <span className="text-[12px] text-g-sub ml-2">
                          {translate('admin:automaticCollectionPaused')}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.deleted ? (
                    <Btn onClick={() => patch(c.id, { deleted: false })}>{translate('admin:restore')}</Btn>
                  ) : confirmDel === c.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[13px] text-g-sub mr-1">
                        {translate('admin:itemsWillLeaveThisCollection', { count: count(c), unit: KINDS[kind].unit })}
                      </span>
                      <Btn onClick={() => setConfirmDel(null)}>{translate('admin:cancel')}</Btn>
                      <Btn
                        kind="danger"
                        onClick={() => {
                          deleteCol(c.id)
                          setConfirmDel(null)
                        }}
                      >
                        {translate('admin:confirmDeletion')}
                      </Btn>
                    </div>
                  ) : (
                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition">
                      {[
                        [
                          P.pin,
                          c.pinned ? translate('admin:unpin') : translate('admin:pin'),
                          () => patch(c.id, { pinned: !c.pinned }),
                        ],
                        [P.edit, translate('admin:renameEditDescription'), () => setEditing(isEditing ? null : c.id)],
                        [
                          P.archive,
                          c.archived ? translate('admin:unarchive') : translate('admin:archive'),
                          () => patch(c.id, { archived: !c.archived }),
                        ],
                        [P.trash, translate('admin:deleteCollectionKeepContent'), () => setConfirmDel(c.id)],
                      ].map(([d, t, f]) => (
                        <button
                          key={t as string}
                          title={t as string}
                          aria-label={t as string}
                          onClick={f as () => void}
                          className="w-9 h-9 grid place-items-center rounded-full text-g-sub hover:bg-g-surface"
                        >
                          <Icon d={d as string} className="w-[18px] h-[18px]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {LIVE && !c.deleted && !isEditing && <CollectionManagement collection={c} articles={arts} />}
              </li>
            )
          })}
        </ul>
        <p className="text-[12px] text-g-sub mt-4">
          {translate('admin:deletingACollectionRemovesMembershipOnlySavedContent')}
        </p>
      </div>
    </div>
  )
}
