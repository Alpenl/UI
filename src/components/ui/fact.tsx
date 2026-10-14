import { type ReactNode } from 'react'

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[12px] text-g-sub">{label}</div>
      <div className="text-[14px] font-medium mt-0.5">{children}</div>
    </div>
  )
}
