import { useMutationLock } from '@/components/ui/mutation-lock'
import type { WorkspaceModel } from '@/app/use-workspace-model'
import { CompactFlow } from '@/components/ui/compact-flow'
import { Group } from '@/components/layout/sidebar-group'
import { Item } from '@/components/layout/sidebar-item'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { KINDS, colDot, type Kind } from '@/domain/library'
export function AppSidebar({
  model,
}: {
  model: Pick<
    WorkspaceModel,
    | 'server'
    | 'translate'
    | 'view'
    | 'kind'
    | 'tags'
    | 'arts'
    | 'dims'
    | 'mode'
    | 'setMode'
    | 'openDims'
    | 'setOpenDims'
    | 'navOpen'
    | 'openSettings'
    | 'draft'
    | 'setDraft'
    | 'createTag'
    | 'kArts'
    | 'kCols'
    | 'quick'
    | 'fTags'
    | 'fCol'
    | 'patch'
    | 'pickKind'
    | 'goLib'
    | 'toggleTag'
    | 'activeCols'
    | 'todo'
  >
}) {
  const locked = useMutationLock()
  const {
    server,
    translate,
    view,
    kind,
    tags,
    arts,
    dims,
    mode,
    setMode,
    openDims,
    setOpenDims,
    navOpen,
    openSettings,
    draft,
    setDraft,
    createTag,
    kArts,
    kCols,
    quick,
    fTags,
    fCol,
    patch,
    pickKind,
    goLib,
    toggleTag,
    activeCols,
    todo,
  } = model
  return (
    <aside
      aria-label={translate('app:sidebar')}
      className={`h-full flex flex-col bg-g-surface border-r border-g-line min-h-0 transition-transform max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:z-40 max-[900px]:w-[280px] max-[900px]:shadow-2xl ${navOpen ? '' : 'max-[900px]:-translate-x-full'}`}
    >
      <button
        onClick={() => pickKind(kind)}
        aria-label={translate('app:cairnHome')}
        className="h-14 px-5 flex items-center gap-2.5 shrink-0"
      >
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="#1f1f1f" aria-hidden="true">
          <ellipse cx="16" cy="26" rx="12" ry="4.2" />
          <ellipse cx="16.5" cy="18.5" rx="8.5" ry="3.6" />
          <ellipse cx="15.5" cy="12" rx="5.5" ry="3" />
          <ellipse cx="16" cy="7" rx="3" ry="2.3" fill="#0b57d0" />
        </svg>
        <span className="font-serif text-[21px] font-semibold tracking-tight">Cairn</span>
      </button>

      <nav aria-label={translate('app:resourceTypes')} className="shrink-0 px-3 pb-3 border-b border-g-line">
        <div className="px-3 mb-1.5 text-[12px] font-medium tracking-[.12em] text-g-sub">
          {translate('app:library')}
        </div>
        <div className="space-y-0.5">
          {(Object.keys(KINDS) as Kind[]).map((k) => {
            const on = kind === k && view === 'lib'
            return (
              <button
                key={k}
                onClick={() => pickKind(k)}
                aria-current={on ? 'page' : undefined}
                className={`w-full h-10 px-3 rounded-lg flex items-center gap-2.5 text-[14px] text-left transition ${on ? 'bg-g-tint text-g-blue-dark font-medium' : 'text-g-ink hover:bg-black/[.04]'}`}
              >
                <Icon d={KINDS[k].icon} className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1 truncate">{KINDS[k].label}</span>
                <span className={`text-[12px] tabular-nums ${on ? 'text-g-blue-dark' : 'text-g-sub'}`}>
                  {server ? (k === 'article' ? server.facets.total : 0) : arts.filter((a) => a.kind === k).length}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto scroll-quiet px-3 pb-3">
        <Group
          title={translate('app:collectionsHeading')}
          right={
            <button
              onClick={() => openSettings('col')}
              aria-label={translate('app:newCollection')}
              className="w-6 h-6 grid place-items-center rounded hover:bg-black/[.06] text-g-sub"
            >
              <Icon d={P.plus} className="w-3.5 h-3.5" />
            </button>
          }
        >
          {activeCols.map((c) => (
            <Item
              key={c.id}
              on={view === 'lib' && fCol === c.id}
              dot={colDot(kCols, c.id)}
              count={c.count ?? kArts.filter((a) => c.id in a.cols).length}
              onClick={() => goLib(() => patch({ quick: 'all', fCol: fCol === c.id ? null : c.id }))}
            >
              {c.name}
            </Item>
          ))}
          {activeCols.length === 0 && (
            <p className="px-3 py-1 text-[12.5px] text-g-sub">{translate('app:noCollectionsYet')}</p>
          )}
        </Group>

        <Group
          title={translate('app:tags')}
          right={
            <div
              role="group"
              aria-label={translate('app:matchMultipleTags')}
              className="flex rounded-full bg-black/[.06] p-px text-[12px]"
            >
              {(['any', 'all'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`px-2 h-5 rounded-full ${mode === m ? 'bg-white shadow-sm text-g-text font-medium' : 'text-g-sub'}`}
                >
                  {m === 'any' ? translate('app:any') : translate('app:all')}
                </button>
              ))}
            </div>
          }
        >
          {dims.map(({ id: d, label: dl }) => {
            const open = openDims.includes(d)
            const list = tags.filter(
              (t) =>
                t.dim === d &&
                t.enabled &&
                (t.user ||
                  (server
                    ? kind === 'article' && (server.facets.tags[t.ref ?? ''] ?? 0) > 0
                    : kArts.some((a) => a.tags.includes(t.name)))),
            )
            return (
              <div key={d}>
                <div className="flex items-center pr-1">
                  <button
                    onClick={() => setOpenDims((x) => (open ? x.filter((y) => y !== d) : [...x, d]))}
                    aria-expanded={open}
                    className="flex-1 min-w-0 h-7 px-3 flex items-center gap-1.5 text-[12.5px] text-g-sub hover:text-g-text"
                  >
                    <Icon d="M9 6l6 6-6 6" className={`w-3 h-3 transition ${open ? 'rotate-90' : ''}`} />
                    {dl}
                    <span className="ml-auto text-[12px]">{list.length}</span>
                  </button>
                  <button
                    disabled={locked}
                    onClick={() => {
                      setOpenDims((x) => (x.includes(d) ? x : [...x, d]))
                      setDraft({ dim: d, name: '', err: '' })
                    }}
                    aria-label={translate('app:addATagTo', { type: dl })}
                    title={translate('app:addTag', { type: dl })}
                    className="w-6 h-6 grid place-items-center rounded text-g-sub hover:bg-black/[.06] hover:text-g-blue"
                  >
                    <Icon d={P.plus} className="w-3.5 h-3.5" />
                  </button>
                </div>
                {open && (
                  <div className="pl-3 pr-1 pb-2 pt-0.5">
                    {draft?.dim === d && (
                      <form
                        className="w-full pr-1 pb-1"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const err = createTag(d, draft.name)
                          if (err) setDraft({ ...draft, err })
                          else setDraft(null)
                        }}
                      >
                        <input
                          disabled={locked}
                          autoFocus
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value, err: '' })}
                          onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
                          onBlur={() => !draft.name.trim() && setDraft(null)}
                          maxLength={20}
                          placeholder={translate('app:newTagPressEnterToAdd', { type: dl })}
                          aria-label={translate('app:newTagName', { type: dl })}
                          aria-invalid={!!draft.err}
                          className="w-full h-7 px-2.5 rounded-lg border border-g-blue bg-white text-[12.5px] outline-none shadow-[0_0_0_3px_rgba(11,87,208,.1)]"
                        />
                        {draft.err && <p className="text-[12px] text-g-red mt-1">{draft.err}</p>}
                      </form>
                    )}
                    {list.length === 0 && draft?.dim !== d && (
                      <p className="text-[12px] text-g-sub">{translate('app:noTagsYetUseToAddOne')}</p>
                    )}
                    <CompactFlow
                      signature={JSON.stringify(
                        list.map((t) => [
                          t.ref ?? t.name,
                          t.name,
                          server
                            ? kind === 'article'
                              ? (server.facets.tags[t.ref ?? ''] ?? 0)
                              : 0
                            : kArts.filter((a) => a.tags.includes(t.name)).length,
                        ]),
                      )}
                    >
                      {list.map((t) => {
                        const on = fTags.includes(t.name)
                        const n = server
                          ? kind === 'article'
                            ? (server.facets.tags[t.ref ?? ''] ?? 0)
                            : 0
                          : kArts.filter((a) => a.tags.includes(t.name)).length
                        return (
                          <button
                            key={t.ref ?? t.name}
                            title={t.name}
                            onClick={() => toggleTag(t.name)}
                            aria-pressed={on}
                            className={`h-6 px-2 rounded-full text-[12px] border transition max-w-full truncate shrink-0 ${on ? 'bg-g-blue border-g-blue text-white' : 'border-[#d3d6da] bg-white hover:border-g-mute'}`}
                          >
                            {t.name} <span className={on ? 'text-white/70' : 'text-g-sub'}>{n}</span>
                          </button>
                        )
                      })}
                    </CompactFlow>
                  </div>
                )}
              </div>
            )
          })}
        </Group>
      </div>

      <div className="shrink-0 border-t border-g-line p-3 space-y-0.5">
        {(todo > 0 || quick === 'todo') && (
          <Item
            on={view === 'lib' && quick === 'todo'}
            dot="#f9ab00"
            count={todo}
            onClick={() =>
              goLib(() => patch({ quick: quick === 'todo' ? 'all' : 'todo', fCol: null, fTags: [], q: '' }))
            }
          >
            {translate('app:needsAttention')}
          </Item>
        )}
        <Item
          on={view === 'set'}
          icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          onClick={() => openSettings('status')}
        >
          {translate('app:settings')}
        </Item>
      </div>
    </aside>
  )
}
