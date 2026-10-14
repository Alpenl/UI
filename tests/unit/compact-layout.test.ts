import { describe, expect, it } from 'vitest'
import { compactOrder } from '../../src/components/ui/compact-layout'

describe('compact visual order', () => {
  const items = [
    { id: 'a', width: 120 },
    { id: 'b', width: 120 },
    { id: 'c', width: 76 },
    { id: 'd', width: 76 },
  ]
  it('fills gaps without changing the input order', () => {
    expect(compactOrder(items, 200)).toEqual(['a', 'c', 'b', 'd'])
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('reuses a plan across remounts and setting-order changes', () => {
    expect(compactOrder([...items].reverse(), 200)).toBe(compactOrder(items, 200))
  })
  it('invalidates for width, font metrics, counts and membership changes', () => {
    const initial = compactOrder(items, 200)
    expect(compactOrder(items, 250)).not.toBe(initial)
    expect(
      compactOrder(
        items.map((item) => ({ ...item, width: item.width + 1 })),
        200,
      ),
    ).not.toBe(initial)
    expect(compactOrder(items.slice(1), 200)).not.toBe(initial)
    expect(
      compactOrder(
        [
          { id: 'long', width: 500 },
          { id: 'short', width: 20 },
        ],
        200,
      ),
    ).toEqual(['long', 'short'])
  })
})
