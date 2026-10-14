import { type ReactNode } from 'react'

export const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between mb-2.5">
    <span className="text-[12px] font-medium tracking-[.12em] text-g-sub uppercase">{children}</span>
    {right}
  </div>
)
