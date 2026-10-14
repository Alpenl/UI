import { type ReactNode } from 'react'

export const Group = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <div className="mt-6">
    <div className="flex items-center justify-between px-3 mb-1.5">
      <span className="text-[12px] font-medium tracking-[.12em] text-g-sub">{title}</span>
      {right}
    </div>
    {children}
  </div>
)
