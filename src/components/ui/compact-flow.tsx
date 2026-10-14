import { Children, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { compactOrder } from './compact-layout'

/** Measures real fonts/pill borders; visual and keyboard order always agree. */
export function CompactFlow({
  children,
  signature,
  gap = 4,
  className = '',
}: {
  children: ReactElement[]
  signature: string
  gap?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<readonly string[]>([])
  useLayoutEffect(() => {
    const element = ref.current!
    let frame = 0
    let lastWidth = -1
    const measure = () => {
      const width = Math.floor(element.getBoundingClientRect().width)
      if (!width) return
      const items = Array.from(element.children, (node) => ({
        id: (node as HTMLElement).dataset.flowId!,
        width: Math.ceil(node.getBoundingClientRect().width),
      }))
      const next = compactOrder(items, width, gap)
      setOrder((previous) =>
        previous.length === next.length && previous.every((id, i) => id === next[i]) ? previous : next,
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      if (width !== lastWidth) {
        lastWidth = width
        schedule()
      }
    })
    observer.observe(element)
    document.fonts.addEventListener('loadingdone', schedule)
    schedule()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.fonts.removeEventListener('loadingdone', schedule)
    }
  }, [signature, gap])
  const elements = Children.toArray(children) as ReactElement[]
  const rank = new Map(order.map((id, i) => [id, i]))
  elements.sort((a, b) => (rank.get(String(a.key)) ?? Infinity) - (rank.get(String(b.key)) ?? Infinity))
  return (
    <div ref={ref} className={`flex flex-wrap ${className}`} style={{ gap }} data-compact-flow="">
      {elements.map((child) => (
        <div key={child.key} data-flow-id={child.key} className="max-w-full flex shrink-0">
          {child}
        </div>
      ))}
    </div>
  )
}
