import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { type Article } from '@/domain/library'

import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import type { LibProps } from '@/features/library/types'

import { OrganizeBody } from '@/features/library/components/organize-body'

export function Inspector({
  a,
  tags,
  cols,
  update,
  dimOf,
  close,
}: Pick<LibProps, 'tags' | 'cols' | 'update' | 'dimOf'> & { a: Article; close: () => void }) {
  const { t: translate } = useTranslation()

  return (
    <aside className="w-[296px] shrink-0 h-full border-l border-g-line bg-g-paper overflow-y-auto scroll-quiet max-[1360px]:absolute max-[1360px]:right-0 max-[1360px]:top-0 max-[1360px]:shadow-[-12px_0_28px_rgba(0,0,0,.08)] slide-in z-10">
      <div className="h-12 px-5 flex items-center justify-between border-b border-g-line">
        <span className="text-[13px] font-semibold">{translate('library:organize')}</span>
        <button
          onClick={close}
          aria-label={translate('library:collapse')}
          className="w-7 h-7 grid place-items-center rounded-full hover:bg-g-surface text-g-sub"
        >
          <Icon d={P.x} className="w-4 h-4" />
        </button>
      </div>

      <OrganizeBody {...{ a, tags, cols, update, dimOf }} />
    </aside>
  )
}
