import { describe, expect, it, vi } from 'vitest'
vi.hoisted(() => vi.stubEnv('VITE_DATA_MODE', 'snapshot'))
import { readDesign } from '@/design/adapter'
import { request } from '@/api/production'
import { z } from 'zod'
import type { Article } from '@/domain/library'
import snapshot from '@/design/snapshot.json'

type Page = { items: Article[]; total: number; next_cursor: number | null }
describe('offline design snapshot', () => {
  it('pages every real article once and preserves classifications', () => {
    const ids: number[] = []
    let cursor: number | null = null
    do {
      const page = readDesign('/api/workspace' + (cursor ? '?cursor=' + cursor : '')) as Page
      ids.push(...page.items.map((a) => a.id))
      cursor = page.next_cursor
    } while (cursor)
    expect(ids).toEqual(snapshot.workspace.items.map((a) => a.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('filters the snapshot and does not mutate the committed data', () => {
    const result = readDesign('/api/workspace?quick=todo') as Page
    expect(result.items.every((a) => a.failed)).toBe(true)
    result.items[0].title = 'not saved'
    expect(JSON.stringify(readDesign('/api/workspace?quick=todo'))).not.toContain('not saved')
    expect((readDesign('/api/workspace?kind=site') as Page).total).toBe(0)
  })
  it('rejects writes and missing endpoints without any network fallback', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    await expect(
      request('/api/tag-system/classification/runs', z.unknown(), { submission_key: 'test' }),
    ).rejects.toMatchObject({ code: 'design_read_only' })
    await expect(request('/api/workspace/999999', z.unknown())).rejects.toThrow('design_endpoint_not_available')
    expect(fetch).not.toHaveBeenCalled()
  })
})
