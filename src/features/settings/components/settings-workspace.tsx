import { MutationBoundary } from '@/components/ui/mutation-lock'
import { LIVE } from '@/api/production-mode'
import { LiveSettings } from './live-settings'
import type { WorkspaceModel } from '@/app/use-workspace-model'
import { KINDS, type Kind } from '@/domain/library'
import { Collections } from '@/features/collections/components/collections'
import { Settings } from '@/features/settings/components/settings'
import { TagLibrary } from '@/features/tags/components/tag-library'
export function SettingsWorkspace({
  model,
}: {
  model: Pick<
    WorkspaceModel,
    | 'translate'
    | 'tags'
    | 'setTags'
    | 'cols'
    | 'setCols'
    | 'arts'
    | 'setArts'
    | 'dims'
    | 'setTab'
    | 'setSetTab'
    | 'hubKind'
    | 'setHubKind'
    | 'online'
    | 'setOnline'
    | 'renameTag'
    | 'deleteTags'
    | 'addDim'
    | 'renameDim'
    | 'recolorDim'
    | 'deleteDim'
    | 'deleteCol'
  >
}) {
  const {
    translate,
    tags,
    setTags,
    cols,
    setCols,
    arts,
    setArts,
    dims,
    setTab,
    setSetTab,
    hubKind,
    setHubKind,
    online,
    setOnline,
    renameTag,
    deleteTags,
    addDim,
    renameDim,
    recolorDim,
    deleteDim,
    deleteCol,
  } = model
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 pt-5 border-b border-g-line">
        <h1 className="text-[22px] font-semibold">{translate('app:settings')}</h1>
        <div role="tablist" className="flex gap-1 mt-3">
          {(
            [
              ['status', translate('app:statusAccount')],
              ['col', translate('app:collectionsTab')],
              ['tag', translate('app:tagLibrary')],
            ] as const
          ).map(([t, l]) => (
            <button
              key={t}
              role="tab"
              aria-selected={setTab === t}
              onClick={() => setSetTab(t)}
              className={`h-9 px-4 text-[14px] border-b-2 -mb-px transition ${setTab === t ? 'border-g-blue text-g-blue-dark font-medium' : 'border-transparent text-g-sub hover:text-g-text'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {setTab === 'status' && (LIVE ? <LiveSettings /> : <Settings online={online} setOnline={setOnline} />)}
        {setTab === 'col' && (
          <div className="h-full flex flex-col">
            <div role="group" aria-label={translate('app:collectionType')} className="shrink-0 px-6 pt-4">
              <div className="flex rounded-full bg-g-surface p-0.5 text-[13px]">
                {(Object.keys(KINDS) as Kind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setHubKind(k)}
                    aria-pressed={hubKind === k}
                    className={`px-4 h-7 rounded-full ${hubKind === k ? 'bg-white shadow-sm font-medium' : 'text-g-sub'}`}
                  >
                    {translate('app:collectionsByKind', { kind: KINDS[k].label })}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <MutationBoundary>
                <Collections
                  key={hubKind}
                  {...{
                    kind: hubKind,
                    cols: cols.filter((c) => c.kind === hubKind),
                    setCols,
                    arts: arts.filter((a) => a.kind === hubKind),
                    tags,
                    setArts,
                    deleteCol,
                  }}
                />
              </MutationBoundary>
            </div>
          </div>
        )}
        {setTab === 'tag' && (
          <MutationBoundary>
            <TagLibrary
              {...{ tags, setTags, arts, renameTag, dims, addDim, renameDim, recolorDim, deleteDim, deleteTags }}
            />
          </MutationBoundary>
        )}
      </div>
    </div>
  )
}
