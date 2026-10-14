import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/api/production-mode', () => ({
  DESIGN: false,
  DESIGN_DATE: '2026-10-14',
  LIVE: true,
  GO_BACKEND: true,
  apiPath: (p: string) => p.replace('/api/', '/api/v1/'),
}))
import { saveChanges, clearOperationJournal, type Snapshot } from '@/api/production'
afterEach(() => {
  vi.unstubAllGlobals()
  clearOperationJournal()
})
for (const change of ['manual', 'archive', 'delete'] as const)
  it(`allows the last Go automatic tag to become ${change}`, async () => {
    const tag = {
      name: '背景',
      dim: 'uses',
      auto: true,
      enabled: true,
      aliases: '',
      desc: '背景知识',
      field: 'uses' as const,
      term: 'a',
      ref: 'system/use/a',
    }
    const before: Snapshot = {
      arts: [],
      cols: [],
      tags: [tag],
      tagStates: {},
      collectionRevisions: {},
      catalogRevision: 4,
    }
    const writes: Record<string, unknown>[] = []
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_p, init: RequestInit) => {
        writes.push(JSON.parse(String(init.body)))
        return Response.json({ code: 'OK', data: { id: 'a', revision: 5 } })
      }),
    )
    const after = {
      ...before,
      tags: [
        {
          ...tag,
          ...(change === 'manual'
            ? { auto: false }
            : change === 'archive'
              ? { enabled: false }
              : { deleteRequested: true }),
        },
      ],
    }
    await saveChanges(before, after)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ type: change === 'manual' ? 'edit' : change, expected_revision: 4 })
  })
