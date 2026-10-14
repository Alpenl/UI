import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Dim } from '@/domain/library'
import { useDims } from '@/features/tags/dimensions'
import { CompactFlow } from '@/components/ui/compact-flow'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
import { useAppTranslation } from '@/i18n/use-translation'

export type CloudItem = {
  id: string
  label: string
  dim: Dim
  count?: number
  /** Filter/selection state: drawn with an outline in the chip's own ink. */
  active?: boolean
  /** Lower emphasis, e.g. candidates that are not yet picked. */
  muted?: boolean
  /** Inline trailing control rendered inside the pill (e.g. scope toggle). */
  extra?: ReactNode
  ariaLabel?: string
  expanded?: boolean
  title?: string
}

/**
 * Tag cloud with dimension colours, uniform pills packed by width and an "edit" mode in which
 * pills jiggle and expose a remove badge, or – with `selected` – become multi-select.
 */
export function TagCloud({
  items,
  onPick,
  editing = false,
  onRemove,
  selected,
  size = 'md',
  empty,
}: {
  items: CloudItem[]
  onPick?: (id: string) => void
  editing?: boolean
  onRemove?: (id: string) => void
  /** When provided together with `editing`, clicks toggle selection instead of removing. */
  selected?: ReadonlySet<string>
  size?: 'sm' | 'md'
  empty?: ReactNode
}) {
  const { t } = useAppTranslation()
  const { def } = useDims()
  if (!items.length) return <>{empty ?? null}</>
  // Uniform pills: one height and type size per cloud; width follows the label only.
  const pill = size === 'sm' ? 'h-6 px-2.5 text-[12px]' : 'h-7 px-3 text-[13px]'
  return (
    <div className={editing ? 'pt-1.5 pr-1.5' : ''}>
      {/* Packed by measured width (not data order) so rows end close to flush. */}
      <CompactFlow
        gap={size === 'sm' ? 6 : 8}
        signature={JSON.stringify([items.map((i) => [i.id, i.label, !!i.extra]), size, editing])}
      >
        {items.map((item, index) => {
          const isSelected = !!selected?.has(item.id)
          const removable = editing && !selected && !!onRemove
          const click = () => {
            if (editing && selected) onRemove?.(item.id)
            else if (removable) onRemove!(item.id)
            else onPick?.(item.id)
          }
          const interactive = !!onPick || editing
          const Pill = interactive ? 'button' : 'span'
          return (
            <span
              key={item.id}
              className={`relative inline-flex ${editing ? 'tag-jiggle' : ''}`}
              style={editing ? { animationDelay: `${-((index * 97) % 260)}ms` } : undefined}
            >
              <Pill
                type={interactive ? 'button' : undefined}
                aria-label={item.ariaLabel}
                aria-expanded={item.expanded}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-pressed={selected ? isSelected : onPick ? !!item.active : undefined}
                title={item.title ?? item.label}
                onClick={interactive ? click : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                        e.preventDefault()
                        click()
                      }
                    : undefined
                }
                className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap max-w-full select-none transition ${pill} ${def(item.dim).chip} ${interactive ? 'cursor-pointer hover:brightness-[.96] active:scale-[.97]' : ''} ${item.active ? 'shadow-[inset_0_0_0_1.5px_currentColor]' : ''} ${item.muted && !item.active ? 'opacity-55 hover:opacity-100' : ''} ${isSelected ? 'shadow-[inset_0_0_0_1.5px_var(--color-g-red)] !bg-g-danger-bg !text-g-danger-ink' : ''}`}
              >
                <span className="truncate">{item.label}</span>
                {item.count !== undefined && <span className="tabular-nums opacity-55 font-normal">{item.count}</span>}
                {item.extra}
              </Pill>
              {editing && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={t('common:removeTag')}
                  onClick={click}
                  className={`tag-pop absolute -top-1.5 -right-1.5 w-[18px] h-[18px] grid place-items-center rounded-full ring-2 ring-white shadow-sm ${selected ? (isSelected ? 'bg-g-red text-white' : 'bg-white text-g-mute border border-g-line') : 'bg-g-text text-white hover:bg-g-red'}`}
                >
                  <Icon d={selected && isSelected ? P.check : P.x} className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          )
        })}
      </CompactFlow>
    </div>
  )
}

/**
 * Single-choice tag picker: search field + tag clouds grouped by dimension.
 * Use instead of a native `<select>` whenever the options are tags.
 */
export function TagPicker({
  tags,
  value,
  onChange,
  noneLabel,
  label,
}: {
  tags: { id: string; label: string; dim: Dim }[]
  value: string
  onChange: (id: string) => void
  /** Optional neutral choice that maps to `''` (e.g. "no broader tag", "whole type"). */
  noneLabel?: string
  label?: string
}) {
  const { t } = useAppTranslation()
  const { dims, def } = useDims()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = tags.filter((tag) => !needle || tag.label.toLowerCase().includes(needle))
  const order = [...new Set([...dims.map((d) => d.id), ...shown.map((tag) => tag.dim)])]
  const groups = order
    .map((dim) => [dim, shown.filter((tag) => tag.dim === dim)] as const)
    .filter(([, xs]) => xs.length)
  const current = tags.find((tag) => tag.id === value)
  return (
    <div role="group" aria-label={label} className="rounded-lg border border-g-line bg-white">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-g-line">
        <Icon d={P.search} className="w-3.5 h-3.5 text-g-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('admin:searchTags')}
          aria-label={t('admin:searchTags')}
          className="flex-1 min-w-0 text-[12.5px] outline-none bg-transparent"
        />
        <span className="text-[12px] text-g-sub truncate max-w-[45%]">
          {current ? current.label : (noneLabel ?? '')}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto scroll-quiet p-3 space-y-3">
        {noneLabel && !needle && (
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onChange('')}
            className={`h-6 px-2.5 rounded-full text-[12px] border border-dashed transition ${!value ? 'border-g-text text-g-text font-medium' : 'border-g-line text-g-sub hover:border-g-mute'}`}
          >
            {noneLabel}
          </button>
        )}
        {groups.map(([dim, xs]) => (
          <div key={dim}>
            <p className="text-[11px] tracking-wide text-g-mute mb-1.5">{def(dim).label}</p>
            <TagCloud
              size="sm"
              onPick={(id) => onChange(id === value && noneLabel ? '' : id)}
              items={xs.map((tag) => ({ ...tag, active: tag.id === value, muted: !!value }))}
            />
          </div>
        ))}
        {!groups.length && <p className="text-[12.5px] text-g-sub">{t('admin:noMatchingTags')}</p>}
      </div>
    </div>
  )
}
