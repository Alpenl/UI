import { ClassificationRuns } from './classification-runs'
import { RelationEditor } from './relation-editor'
import { LIVE, fields } from '@/api/production'
import { GO_BACKEND } from '@/api/production-mode'
import { liveStore } from '@/api/live-store'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { DIM_PALETTE, KINDS, type Article, type Dim, type DimDef, type Kind, type Tag } from '@/domain/library'

import { Chip } from '@/components/domain/tag-chip'
import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'

import { DimNameEdit } from '@/features/tags/components/dimension-name-edit'

import { ClassificationFields } from './classification-fields'

import { NameField } from '@/features/tags/components/tag-name-field'

export function TagLibrary({
  tags,
  setTags,
  arts,
  renameTag,
  dims,
  addDim,
  renameDim,
  recolorDim,
  deleteDim,
  deleteTags,
}: {
  tags: Tag[]
  setTags: Dispatch<SetStateAction<Tag[]>>
  arts: Article[]
  renameTag: (from: string, to: string) => string | null
  dims: DimDef[]
  addDim: (label: string) => { id?: string; err?: string }
  renameDim: (id: string, label: string) => string | null
  recolorDim: (id: string, chip: string) => void
  deleteDim: (id: string) => Promise<boolean>
  deleteTags: (names: string[]) => Promise<boolean>
}) {
  const { t: translate } = useTranslation()

  const basisEnabled = LIVE && GO_BACKEND && liveStore.getSnapshot().data.classificationVersion === 1
  const [basisDim, setBasisDim] = useState<string | null>(null)
  const [keepAlias, setKeepAlias] = useState(true)
  const [dimId, setDim] = useState<Dim>(dims[0]?.id ?? '')
  const [showArchivedTypes, setShowArchivedTypes] = useState(false)
  const [archivedDelete, setArchivedDelete] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [newDim, setNewDim] = useState<string | null>(null)
  const [dimErr, setDimErr] = useState('')
  const [editDim, setEditDim] = useState<string | null>(null)
  const [dimConfirm, setDimConfirm] = useState<'archive' | 'delete' | null>(null)
  const [tagConfirm, setTagConfirm] = useState<string | null>(null)
  useEffect(() => {
    if (LIVE) liveStore.setEditing(!!open || !!editDim || !!basisDim || newDim !== null)
    return () => {
      if (LIVE) liveStore.setEditing(false)
    }
  }, [open, editDim, newDim, basisDim])
  const customType = (id: string) => !fields.includes(id as (typeof fields)[number]) && id !== 'custom'
  const cur = dims.find((d) => d.id === dimId) ?? dims[0]
  const dim = cur?.id ?? ''
  const list = tags.filter((t) => t.dim === dim)
  const patch = (n: string, v: Partial<Tag>) => setTags((x) => x.map((t) => (t.name === n ? { ...t, ...v } : t)))
  const usage = (names: string[]) =>
    LIVE
      ? names.reduce(
          (n, name) =>
            n + (liveStore.getSnapshot().data.server?.facets.tags[tags.find((t) => t.name === name)?.ref ?? ''] ?? 0),
          0,
        )
      : arts.filter((a) => a.tags.some((t) => names.includes(t))).length

  const add = () => {
    let i = tags.length + 1
    while (tags.some((t) => t.name === translate('admin:newTag') + i)) i++
    const name = translate('admin:newTag') + i
    setTags((x) => [
      ...x,
      { name, dim, auto: !LIVE || dim !== 'custom', enabled: true, aliases: '', desc: '', user: true },
    ])
    setOpen(name)
  }
  const submitDim = () => {
    const r = addDim(newDim ?? '')
    if (r.err) return setDimErr(r.err)
    setDim(r.id!)
    setNewDim(null)
    setDimErr('')
    setOpen(null)
  }
  const dimTagNames = list.map((t) => t.name)

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-4xl mx-auto px-8 pt-8 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold leading-tight">{translate('app:tagLibrary')}</h1>
            <p className="text-[14px] text-g-sub mt-2 max-w-[56ch] leading-relaxed">
              {translate('admin:articlesAndWebsitesShareTheSameTagsAdd')}
            </p>
          </div>
          <Btn kind="primary" onClick={add} disabled={!cur}>
            <Icon d={P.plus} className="w-4 h-4" /> {translate('admin:addTag')}
          </Btn>
        </div>

        <div role="tablist" className="mt-8 flex flex-wrap items-center gap-1.5">
          {dims.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={dim === d.id}
              onClick={() => {
                setBasisDim(null)
                setDim(d.id)
                setOpen(null)
                setEditDim(null)
                setDimConfirm(null)
              }}
              className={`h-8 px-3.5 rounded-[4px] text-[13px] font-medium whitespace-nowrap border transition ${dim === d.id ? 'bg-g-text border-g-text text-white' : 'border-g-line bg-white text-g-ink hover:border-g-mute'}`}
            >
              {d.label}{' '}
              <span className={`font-normal ml-1 tabular-nums ${dim === d.id ? 'text-white/60' : 'text-g-sub'}`}>
                {tags.filter((t) => t.dim === d.id).length}
              </span>
            </button>
          ))}
          {newDim === null ? (
            <button
              onClick={() => setNewDim('')}
              aria-label={translate('admin:addTagType')}
              title={translate('admin:addTagType')}
              className="h-8 px-3 rounded-[4px] text-[13px] text-g-blue hover:bg-g-tint inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Icon d={P.plus} className="w-4 h-4" /> {translate('admin:addType')}
            </button>
          ) : (
            <form
              className="ml-2 flex items-center gap-2 shrink-0"
              onSubmit={(e) => {
                e.preventDefault()
                submitDim()
              }}
            >
              <input
                autoFocus
                value={newDim}
                maxLength={12}
                onChange={(e) => {
                  setNewDim(e.target.value)
                  setDimErr('')
                }}
                onKeyDown={(e) => e.key === 'Escape' && (setNewDim(null), setDimErr(''))}
                placeholder={translate('admin:typeNameEGDifficulty')}
                aria-label={translate('admin:newTypeName')}
                aria-invalid={!!dimErr}
                className={`h-8 w-40 px-3 rounded-[4px] border bg-white text-[13px] outline-none ${dimErr ? 'border-g-red' : 'border-g-blue'}`}
              />
              <Btn kind="primary" onClick={submitDim}>
                {translate('library:add')}
              </Btn>
              <button
                type="button"
                onClick={() => (setNewDim(null), setDimErr(''))}
                aria-label={translate('admin:cancel')}
                className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-surface"
              >
                <Icon d={P.x} className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
        {LIVE && (
          <div className="mt-3 flex flex-wrap gap-3 text-[13px] text-g-blue">
            <button onClick={() => setShowArchivedTypes((v) => !v)}>{translate('admin:archivedTypes')}</button>
            {showArchivedTypes &&
              liveStore
                .getSnapshot()
                .data.dims?.filter((d) => d.archived)
                .map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        liveStore.update('dims', (xs) =>
                          (xs ?? []).map((x) => (x.id === d.id ? { ...x, archived: false } : x)),
                        )
                      }
                    >
                      {translate('admin:restoreNamed', { name: d.label })}
                    </button>
                    <button
                      aria-label={translate('admin:deleteNamedType', { name: d.label })}
                      onClick={() => setArchivedDelete(archivedDelete === d.id ? null : d.id)}
                      className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:text-g-red hover:bg-g-danger-bg"
                    >
                      <Icon d={P.trash} className="w-4 h-4" />
                    </button>
                    {archivedDelete === d.id && (
                      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg text-g-danger-ink bg-g-danger-bg">
                        <p>
                          {translate('admin:deleteTypeConsequences', {
                            tagCount: tags.filter((tag) => tag.dim === d.id).length,
                          })}
                        </p>
                        <Btn
                          kind="danger"
                          onClick={async () => {
                            if (await deleteDim(d.id)) setArchivedDelete(null)
                          }}
                        >
                          {translate('admin:confirmDeletion')}
                        </Btn>
                        <button onClick={() => setArchivedDelete(null)}>{translate('admin:cancel')}</button>
                      </div>
                    )}
                  </div>
                ))}
          </div>
        )}
        {dimErr && <p className="text-[12.5px] text-g-red mt-2">{dimErr}</p>}

        {!cur && (
          <p className="py-16 text-center text-[14px] text-g-sub">{translate('admin:noTagTypesYetSelectAddTypeTo')}</p>
        )}

        {cur && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-g-line bg-white px-4 py-3 text-[13px]">
            {editDim === cur.id ? (
              <DimNameEdit
                key={cur.id}
                name={cur.label}
                save={(v) => {
                  const e = renameDim(cur.id, v)
                  if (!e) setEditDim(null)
                  return e
                }}
                cancel={() => setEditDim(null)}
              />
            ) : (
              <>
                <Chip dim={cur.id}>{cur.label}</Chip>
                <button
                  onClick={() => setEditDim(cur.id)}
                  className="text-g-blue hover:underline inline-flex items-center gap-1"
                >
                  <Icon d={P.edit} className="w-3.5 h-3.5" /> {translate('admin:renameType')}
                </button>
              </>
            )}
            <span className="flex items-center gap-1" role="group" aria-label={translate('admin:typeColor')}>
              {DIM_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => recolorDim(cur.id, c)}
                  aria-label={translate('admin:chooseColor')}
                  aria-pressed={cur.chip === c}
                  className={`w-5 h-5 rounded-full border ${c.split(' ')[0]} ${cur.chip === c ? 'ring-2 ring-g-blue ring-offset-1' : 'border-black/10'}`}
                />
              ))}
            </span>
            {LIVE && customType(cur.id) && (
              <label className="flex items-center gap-2">
                <Switch
                  on={cur.auto ?? true}
                  label={translate('admin:automaticAiTagging')}
                  onChange={(auto) =>
                    liveStore.update('dims', (xs) => (xs ?? []).map((d) => (d.id === cur.id ? { ...d, auto } : d)))
                  }
                />
                {translate('admin:automaticAiTagging')}
              </label>
            )}
            <span className="ml-auto">
              {dimConfirm ? (
                <span className="flex items-center gap-2 text-g-danger-ink bg-g-danger-bg rounded-lg p-3 flex-wrap">
                  {translate(
                    dimConfirm === 'archive' ? 'admin:archiveTypePreserveTags' : 'admin:deleteTypeConsequences',
                    {
                      tagCount: list.length,
                      resourceCount: usage(dimTagNames),
                    },
                  )}
                  <Btn
                    kind="danger"
                    onClick={async () => {
                      if (dimConfirm === 'archive') {
                        liveStore.update('dims', (xs) =>
                          (xs ?? []).map((d) => (d.id === cur.id ? { ...d, archived: true } : d)),
                        )
                        void liveStore.flush()
                      } else if (!(await deleteDim(cur.id))) return
                      setDimConfirm(null)
                      setOpen(null)
                    }}
                  >
                    {translate('admin:confirmDeletion')}
                  </Btn>
                  <button onClick={() => setDimConfirm(null)} className="px-2 text-g-sub hover:text-g-text">
                    {translate('admin:cancel')}
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-4">
                  {LIVE && customType(cur.id) && (
                    <button onClick={() => setDimConfirm('archive')} className="text-g-sub hover:underline">
                      {translate('admin:archiveType')}
                    </button>
                  )}
                  <button
                    onClick={() => setDimConfirm('delete')}
                    disabled={dims.length <= 1 || (LIVE && !customType(cur.id))}
                    title={
                      LIVE && !customType(cur.id)
                        ? translate('admin:fixedTypeCannotDelete')
                        : dims.length <= 1
                          ? translate('admin:keepAtLeastOneType')
                          : undefined
                    }
                    className="text-g-red hover:underline inline-flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                  >
                    <Icon d={P.trash} className="w-3.5 h-3.5" /> {translate('admin:deleteType')}
                  </button>
                </span>
              )}
            </span>
          </div>
        )}
        {basisEnabled && cur && liveStore.getSnapshot().data.classificationRuns !== undefined && (
          <ClassificationRuns dimension={cur.id} />
        )}
        {basisEnabled && cur && (
          <div className="mt-4 px-2">
            <button
              className="text-[13px] text-g-blue"
              aria-expanded={basisDim === cur.id}
              onClick={() => setBasisDim(basisDim === cur.id ? null : cur.id)}
            >
              {translate('admin:typeClassificationBasis')}
            </button>
            {basisDim === cur.id && (
              <div className="mt-3 rounded-lg border border-g-line p-4">
                <ClassificationFields
                  label={cur.label}
                  value={cur.aiLabel ?? cur.label}
                  description={cur.description ?? ''}
                  changeClass={cur.changeClass}
                  onChange={(value) =>
                    liveStore.update('dims', (xs) =>
                      (xs ?? []).map((d) =>
                        d.id === cur.id
                          ? {
                              ...d,
                              ...(value.aiLabel !== undefined ? { aiLabel: value.aiLabel } : {}),
                              ...(value.desc !== undefined ? { description: value.desc } : {}),
                              changeClass: value.changeClass,
                            }
                          : d,
                      ),
                    )
                  }
                />
                <p className="mt-3 text-[12px] text-g-sub">
                  {translate('admin:typeBasisImpact', { count: list.length })}
                </p>
                <Btn onClick={() => setBasisDim(null)}>{translate('admin:done')}</Btn>
              </div>
            )}
          </div>
        )}
        {LIVE && cur && !customType(cur.id) && (
          <p className="mt-3 px-2 text-[12.5px] text-g-sub">
            {translate(GO_BACKEND ? 'admin:builtInTypeCanBeEmpty' : 'admin:fixedTypeCannotDelete')}
          </p>
        )}

        <div className="mt-5 rounded-t-md border border-b-0 border-g-line bg-g-paper grid grid-cols-[minmax(0,1fr)_120px_100px_72px] max-[700px]:grid-cols-[minmax(0,1fr)_72px] px-4 h-10 items-center text-[12px] text-g-sub tracking-wide">
          <span>{translate('sites:name')}</span>
          <span className="max-[700px]:hidden">{translate('admin:usage')}</span>
          <span className="max-[700px]:hidden">{translate('admin:assignment')}</span>
          <span />
        </div>
        <ul className="rounded-b-md border border-g-line bg-white overflow-hidden divide-y divide-g-line">
          {list.map((t) => (
            <li key={t.ref ?? t.name}>
              <div
                className={`grid grid-cols-[minmax(0,1fr)_120px_100px_72px] max-[700px]:grid-cols-[minmax(0,1fr)_72px] px-4 min-h-14 items-center hover:bg-g-paper transition ${!t.enabled ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0 flex flex-wrap items-center gap-2 py-2">
                  <Chip dim={t.dim}>{t.name}</Chip>
                  {t.aliases && (
                    <span className="text-[12px] text-g-sub">
                      {translate('admin:aliasesSummary', { aliases: t.aliases })}
                    </span>
                  )}
                  {!t.enabled && <span className="text-[12px] text-g-red">{translate('admin:disabled')}</span>}
                </div>
                <span className="text-[13px] tabular-nums text-g-sub max-[700px]:hidden">
                  {(Object.keys(KINDS) as Kind[])
                    .map(
                      (k) =>
                        `${KINDS[k].label} ${LIVE ? (k === 'article' ? usage([t.name]) : 0) : arts.filter((a) => a.kind === k && a.tags.includes(t.name)).length}`,
                    )
                    .join(' · ')}
                </span>
                <span className={`text-[13px] max-[700px]:hidden ${t.auto ? 'text-g-green' : 'text-g-sub'}`}>
                  {t.auto && cur?.auto !== false ? translate('admin:aiAssisted') : translate('admin:manualOnly')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setOpen(open === t.name ? null : t.name)}
                    aria-label={translate('admin:editTag', { name: t.name })}
                    aria-expanded={open === t.name}
                    className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:bg-g-surface"
                  >
                    <Icon d={P.edit} className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTagConfirm(tagConfirm === t.name ? null : t.name)}
                    aria-label={translate('admin:deleteTag', { name: t.name })}
                    aria-expanded={tagConfirm === t.name}
                    className="w-8 h-8 grid place-items-center rounded-[4px] text-g-sub hover:text-g-red hover:bg-g-danger-bg"
                  >
                    <Icon d={P.trash} className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {tagConfirm === t.name && (
                <div
                  role="group"
                  aria-label={translate('admin:deleteTag', { name: t.name })}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px] text-g-danger-ink bg-g-danger-bg"
                >
                  <p className="flex-1 min-w-40">
                    {translate(LIVE ? 'admin:deleteTagConsequences' : 'admin:removeFromResources', {
                      count: usage([t.name]),
                    })}
                  </p>
                  <Btn
                    kind="danger"
                    onClick={async () => {
                      if (!(await deleteTags([t.name]))) return
                      setTagConfirm(null)
                      setOpen(null)
                    }}
                  >
                    {translate('admin:confirmDeletion')}
                  </Btn>
                  <button onClick={() => setTagConfirm(null)} className="px-2 text-g-sub">
                    {translate('admin:cancel')}
                  </button>
                </div>
              )}
              {open === t.name && (
                <div className="bg-g-paper border-t border-g-line px-6 py-6 grid gap-4 [&>*]:min-w-0 grid-cols-2 max-[1000px]:grid-cols-1">
                  {LIVE &&
                    liveStore.getSnapshot().data.relationsVersion === 1 &&
                    liveStore.getSnapshot().data.structureEditable !== false &&
                    t.ref &&
                    !t.ref.startsWith('draft/') && <RelationEditor key={t.ref} tagRef={t.ref} />}
                  <NameField
                    name={t.displayLabel ?? (t as { sourceLabel?: string }).sourceLabel ?? t.name}
                    rename={(to) => {
                      const e = renameTag(t.name, to)
                      if (!e && to.trim()) {
                        const next = LIVE ? liveStore.getSnapshot().data.tags.find((x) => x.ref === t.ref) : undefined
                        if (
                          basisEnabled &&
                          keepAlias &&
                          to.trim() !== ((t as { sourceLabel?: string }).sourceLabel ?? t.name)
                        ) {
                          const oldName = (t as { sourceLabel?: string }).sourceLabel ?? t.name
                          setTags((xs) =>
                            xs.map((x) =>
                              x.ref === t.ref
                                ? {
                                    ...x,
                                    aliases: [
                                      ...new Set([
                                        ...x.aliases
                                          .split(/[,，]/)
                                          .map((v) => v.trim())
                                          .filter(Boolean),
                                        oldName,
                                      ]),
                                    ].join(', '),
                                  }
                                : x,
                            ),
                          )
                        }
                        setOpen(next?.name ?? to.trim())
                      }
                      return e
                    }}
                  />
                  <label className="text-[12px] text-g-sub">
                    {translate('admin:type')}
                    <select
                      disabled={LIVE && !t.ref?.startsWith('custom/') && !t.ref?.startsWith('draft/')}
                      value={t.dim}
                      onChange={(e) => {
                        patch(t.name, { dim: e.target.value })
                        if (!basisEnabled) setOpen(null)
                      }}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-g-line bg-white text-[14px] text-g-text focus:border-g-blue outline-none"
                    >
                      {dims
                        .filter((d) => !LIVE || !t.ref?.startsWith('custom/') || customType(d.id) || d.id === 'custom')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-[12px] text-g-sub">
                    {translate('admin:aliases')}
                    <input
                      value={t.aliases}
                      onChange={(e) => patch(t.name, { aliases: e.target.value })}
                      placeholder={translate('admin:eGLowRankAdaptation')}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-g-line bg-white text-[14px] text-g-text focus:border-g-blue outline-none"
                    />
                  </label>
                  {basisEnabled ? (
                    <>
                      <label className="flex items-center gap-2 text-[12px] text-g-sub">
                        <input type="checkbox" checked={keepAlias} onChange={(e) => setKeepAlias(e.target.checked)} />
                        <span className="min-w-0">{translate('admin:keepOldNameAlias')}</span>
                      </label>
                      <details
                        className="col-span-2 max-[1000px]:col-span-1 rounded-lg border border-g-line p-3"
                        open={!t.inputVersion || undefined}
                      >
                        <summary className="cursor-pointer text-[13px] text-g-blue">
                          {translate('admin:classificationBasis')}
                        </summary>
                        <div className="mt-3">
                          <ClassificationFields
                            label={t.displayLabel ?? (t as { sourceLabel?: string }).sourceLabel ?? t.name}
                            value={t.aiLabel ?? t.name}
                            description={t.desc}
                            changeClass={t.changeClass}
                            onChange={(v) => patch(t.name, v)}
                          />
                          <p className="mt-3 text-[12px] text-g-sub">
                            {translate('admin:typeBasisSummary', {
                              name: cur.aiLabel ?? cur.label,
                              description: cur.description || '—',
                            })}
                          </p>
                          {!!t.inputVersion && (
                            <p className="mt-2 text-[12px] text-g-sub">
                              {translate('admin:classificationVersion', { version: t.inputVersion })}
                            </p>
                          )}
                        </div>
                      </details>
                      <p className="col-span-2 max-[1000px]:col-span-1 text-[12px] text-g-sub">
                        {translate('admin:classificationReview', {
                          unknown: t.review?.unknown ?? 0,
                          count: t.review?.needs_review ?? 0,
                        })}
                      </p>
                      <p className="col-span-2 max-[1000px]:col-span-1 text-[12px] text-g-sub">
                        {translate('admin:lifecycleHint')}
                      </p>
                    </>
                  ) : (
                    <>
                      <label className="text-[12px] text-g-sub col-span-2 max-[1000px]:col-span-1">
                        {translate('admin:whenToApplyOrExclude')}
                        <textarea
                          value={t.desc}
                          onChange={(e) => patch(t.name, { desc: e.target.value })}
                          rows={2}
                          placeholder={translate('admin:defineSubstantiveDiscussionVersusAPassingMention')}
                          className="mt-1 w-full p-3 rounded-lg border border-g-line bg-white text-[14px] text-g-text resize-none focus:border-g-blue outline-none"
                        />
                      </label>
                    </>
                  )}
                  <div className="flex items-center gap-8 col-span-2 max-[1000px]:col-span-1 text-[14px]">
                    <label className="flex items-center gap-2">
                      <Switch
                        on={t.auto}
                        onChange={(v) => patch(t.name, { auto: v })}
                        label={translate('admin:automaticAiTagging')}
                      />{' '}
                      {translate('admin:automaticAiTagging')}
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        on={t.enabled}
                        onChange={(v) => patch(t.name, { enabled: v })}
                        label={translate('admin:enabled')}
                      />{' '}
                      {translate('admin:enabled')}
                    </label>
                    <span className="ml-auto flex items-center gap-2">
                      <Btn kind="text" onClick={() => setTagConfirm(t.name)}>
                        <Icon d={P.trash} className="w-4 h-4" /> {translate('admin:delete')}
                      </Btn>
                      <Btn
                        disabled={
                          LIVE &&
                          (!t.name.trim() ||
                            ((t.auto || (!GO_BACKEND && fields.includes(t.dim as (typeof fields)[number]))) &&
                              !t.desc.trim()))
                        }
                        onClick={() => {
                          setOpen(null)
                          setTagConfirm(null)
                        }}
                      >
                        {translate('admin:done')}
                      </Btn>
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
          {cur && list.length === 0 && (
            <li className="py-16 text-center text-[14px] text-g-sub">{translate('admin:noTagsInThisTypeYet')}</li>
          )}
        </ul>
        <p className="text-[12px] text-g-sub mt-5 text-center">
          {translate(
            basisEnabled ? 'admin:lifecycleHint' : 'admin:disablingStopsNewAutomaticAssignmentsExistingTagsAre',
          )}
        </p>
      </div>
    </div>
  )
}
