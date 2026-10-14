// Bounded, session-only cache: never persist private label text to storage.
const plans = new Map<string, readonly string[]>()

export function compactOrder(items: readonly { id: string; width: number }[], width: number, gap = 4) {
  const canonical = [...items].sort((a, b) => a.id.localeCompare(b.id))
  const key = JSON.stringify([width, gap, canonical])
  const cached = plans.get(key)
  if (cached) return cached
  const rows: { remaining: number; ids: string[] }[] = []
  for (const item of canonical.sort((a, b) => b.width - a.width || a.id.localeCompare(b.id))) {
    const size = Math.min(width, item.width)
    const row = rows.filter((r) => r.remaining >= size + gap).sort((a, b) => a.remaining - b.remaining)[0]
    if (row) {
      row.ids.push(item.id)
      row.remaining -= size + gap
    } else rows.push({ remaining: width - size, ids: [item.id] })
  }
  const result = rows.flatMap((row) => row.ids)
  if (plans.size >= 128) plans.delete(plans.keys().next().value!)
  plans.set(key, result)
  return result
}
