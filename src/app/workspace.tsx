import { MutationLock } from '@/components/ui/mutation-lock'
import { LIVE } from '@/api/production'
import { LiveNotice } from '@/features/settings/components/live-notice'
import { lazy, Suspense, useEffect } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Icon } from '@/components/ui/icon'
import { KINDS } from '@/domain/library'
const loadWorkspace = () =>
  import('@/features/library/components/workspace').then((module) => ({ default: module.Workspace }))
const Workspace = lazy(loadWorkspace)
const SettingsWorkspace = lazy(() =>
  import('@/features/settings/components/settings-workspace').then((module) => ({ default: module.SettingsWorkspace })),
)
const SiteWorkspace = lazy(() =>
  import('@/features/sites/components/site-workspace').then((module) => ({ default: module.SiteWorkspace })),
)
const TrashWorkspace = lazy(() =>
  import('@/features/trash/components/trash-workspace').then((module) => ({ default: module.TrashWorkspace })),
)
import { DimsCtx } from '@/features/tags/dimensions'
import { useWorkspaceModel } from './use-workspace-model'
export function App() {
  const model = useWorkspaceModel()
  const { translate, view, kind, dims, navOpen, setNavOpen, libProps } = model
  // Load display code during the initial API request, while the skeleton is mounted.
  useEffect(() => {
    if (LIVE && view === 'lib' && kind === 'article') void loadWorkspace().catch(() => {})
  }, [view, kind])
  const locked =
    LIVE && (model.live.saving || (!!model.live.error && model.live.error !== 'validation' && model.live.dirty))
  if (LIVE && !model.live.data.server)
    return (
      <div
        className="h-full overflow-hidden grid grid-rows-[minmax(0,1fr)] grid-cols-[248px_1fr] max-[900px]:grid-cols-1"
        aria-busy={model.live.loading}
      >
        <aside className="bg-g-surface border-r border-g-line p-6 max-[900px]:hidden">
          <div className="font-serif text-[21px] font-semibold mb-12">Cairn</div>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-5 w-3/4 rounded bg-g-line mb-7 animate-pulse" />
          ))}
        </aside>
        <main className="flex min-h-0 flex-col">
          <LiveNotice state={model.live} />
          <div className="grid grid-cols-[372px_1fr] max-[900px]:grid-cols-1 flex-1 min-h-0">
            <div className="border-r border-g-line bg-g-paper p-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-20 rounded-xl bg-g-surface mb-6 animate-pulse" />
              ))}
            </div>
            <div className="p-10 max-[900px]:hidden">
              <div className="h-8 w-1/2 bg-g-surface rounded mb-10 animate-pulse" />
              <div className="h-28 border border-g-line rounded-xl mb-10" />
              <div className="h-52 bg-g-surface rounded-xl animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    )
  return (
    <MutationLock.Provider value={locked}>
      <DimsCtx.Provider value={dims}>
        <div className="h-full overflow-hidden grid grid-rows-[minmax(0,1fr)] grid-cols-[248px_1fr] max-[900px]:grid-cols-1">
          {navOpen && (
            <div className="min-[901px]:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setNavOpen(false)} />
          )}
          <div className="contents">
            <AppSidebar model={model} />
          </div>

          <main className="min-w-0 min-h-0 bg-white flex flex-col">
            <header className="min-[901px]:hidden h-12 shrink-0 flex items-center gap-1 px-2 border-b border-g-line">
              <button
                onClick={() => setNavOpen(true)}
                aria-label={translate('app:openNavigation')}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-g-surface"
              >
                <Icon d="M4 7h16M4 12h16M4 17h16" className="w-5 h-5" />
              </button>
              <span className="font-serif text-[18px] font-semibold">Cairn</span>
              <span className="text-[13px] text-g-sub ml-2">
                {view === 'set'
                  ? translate('app:settings')
                  : view === 'trash'
                    ? translate('app:trash')
                    : KINDS[kind].label}
              </span>
            </header>
            <LiveNotice state={model.live} />
            <div className="flex-1 min-h-0">
              <Suspense fallback={<div className="h-full bg-white" aria-busy="true" />}>
                {view === 'lib' && kind === 'article' && <Workspace {...libProps} />}
                {view === 'lib' && kind === 'site' && <SiteWorkspace {...libProps} />}
                {view === 'set' && <SettingsWorkspace model={model} />}
                {view === 'trash' && <TrashWorkspace model={model} />}
              </Suspense>
            </div>
          </main>
          {model.trashNotice && (
            <div
              role="status"
              className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-1 rounded-xl bg-g-text py-1.5 pl-5 pr-2 text-[13.5px] text-white shadow-[0_8px_28px_rgba(0,0,0,.28)] rise"
            >
              {translate('common:designReadOnly')}
              <button
                onClick={() => model.setTrashNotice(false)}
                aria-label={translate('library:clear')}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
              >
                <Icon d="M6 6l12 12M18 6 6 18" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </DimsCtx.Provider>
    </MutationLock.Provider>
  )
}
