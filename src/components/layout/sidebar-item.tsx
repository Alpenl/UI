import { type ReactNode } from 'react'

import { Icon } from '@/components/ui/icon'

export const Item = ({
  on,
  onClick,
  icon,
  dot,
  children,
  count,
}: {
  on?: boolean
  onClick: () => void
  icon?: string
  dot?: string
  children: ReactNode
  count?: number | string
}) => (
  <button
    onClick={onClick}
    aria-current={on ? 'page' : undefined}
    className={`w-full h-8 px-3 rounded-lg flex items-center gap-2.5 text-[13.5px] text-left transition ${on ? 'bg-g-tint text-g-blue-dark font-medium' : 'text-g-ink hover:bg-black/[.04]'}`}
  >
    {icon && <Icon d={icon} className="w-4 h-4 shrink-0" />}
    {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
    <span className="flex-1 truncate">{children}</span>
    {count !== undefined && (
      <span className={`text-[12px] tabular-nums ${on ? 'text-g-blue-dark' : 'text-g-sub'}`}>{count}</span>
    )}
  </button>
)
