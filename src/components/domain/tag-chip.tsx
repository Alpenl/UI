import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { type ReactNode } from 'react'

import { type Dim } from '@/domain/library'

import { useDims } from '@/features/tags/dimensions'

import { Icon } from '@/components/ui/icon'

import { P } from '@/components/ui/icons'

export const Chip = ({
  dim,
  children,
  onRemove,
  onClick,
  active,
}: {
  dim: Dim
  children: ReactNode
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}) => {
  const { t: translate } = useTranslation()

  const { def } = useDims()
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? !!active : undefined}
      title={onClick ? (active ? translate('common:clearFilter') : translate('common:filterByThisTag')) : undefined}
      className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-medium ${def(dim).chip} ${onClick ? 'cursor-pointer hover:brightness-95 hover:shadow-sm transition' : ''} ${active ? 'ring-2 ring-g-blue ring-offset-1' : ''}`}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={translate('common:removeTag')}
          className="-mr-1 w-4 h-4 grid place-items-center rounded-full hover:bg-black/10"
        >
          <Icon d={P.x} className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}
