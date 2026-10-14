export function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-[14px]">
        <span>{label}</span>
        <span className="tabular-nums text-g-sub">
          <span className="text-g-text font-medium">{used}</span> / {max}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full bg-g-surface overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`h-full rounded-full ${pct > 85 ? 'bg-g-amber' : 'bg-g-blue'}`} style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
