import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { RANGES, dayLabel, type Range } from '@/domain/library'

import { Icon } from '@/components/ui/icon'

import { P } from '@/components/ui/icons'

export const RangeBar = ({ range, setRange }: { range: Range; setRange: (r: Range) => void }) => {
  const { t: translate } = useTranslation()
  return (
    <div role="group" aria-label={translate('common:timeRange')} className="flex flex-wrap items-center gap-1.5">
      <div className="flex rounded-full bg-g-surface p-0.5 text-[12.5px]">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
            className={`px-3 h-7 rounded-full whitespace-nowrap transition ${range === r.id ? 'bg-white shadow-sm font-medium text-g-text' : 'text-g-sub hover:text-g-text'}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range[0] === 'd' && (
        <span className="h-7 pl-3 pr-1 rounded-full bg-g-tint text-g-blue-dark text-[12.5px] font-medium inline-flex items-center gap-1">
          {dayLabel(+range.slice(1))}
          <button
            onClick={() => setRange('all')}
            aria-label={translate('common:clearDayFilter')}
            className="w-5 h-5 grid place-items-center rounded-full hover:bg-black/10"
          >
            <Icon d={P.x} className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  )
}
