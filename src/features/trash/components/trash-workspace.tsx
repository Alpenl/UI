import type { WorkspaceModel } from '@/app/use-workspace-model'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { useAppTranslation } from '@/i18n/use-translation'
type Model = Pick<WorkspaceModel, 'pickKind'>

export function TrashWorkspace({ model }: { model: Model }) {
  const { t } = useAppTranslation()

  return (
    <div className="h-full overflow-y-auto scroll-quiet bg-white">
      <div className="mx-auto max-w-[840px] px-10 pt-12 pb-24 max-[600px]:px-5 max-[600px]:pt-8">
        <div className="flex items-start justify-between gap-4 max-[600px]:flex-col">
          <div className="min-w-0">
            <h1 className="font-serif text-[30px] font-semibold leading-tight">{t('library:trashTitle')}</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-g-sub">{t('common:designReadOnly')}</p>
          </div>
        </div>

        <div className="mt-14 rounded-xl border border-dashed border-g-line bg-g-paper px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-g-surface text-g-sub">
            <Icon d={P.trash} className="w-5 h-5" />
          </div>
          <div className="mt-4 font-serif text-[18px] font-medium">{t('library:trashSnapshotTitle')}</div>
          <p className="mt-1.5 text-[13px] text-g-sub">{t('library:trashSnapshotBody')}</p>
          <Button kind="outline" className="mt-6" onClick={() => model.pickKind('article')}>
            {t('library:backToLibrary')}
          </Button>
        </div>
        <p className="mt-10 text-[12px] leading-relaxed text-g-mute">{t('common:designReadOnly')}</p>
      </div>
    </div>
  )
}
