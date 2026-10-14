import { describe, expect, it } from 'vitest'
import { articlesSchema, collectionsSchema, tagsSchema } from '@/domain/schemas'
import { ARTS0, COLS0, TAGS0 } from '@/mocks/fixtures'
import { inRange, needsAttention, ruleMatch } from '@/domain/library'
import { readStored } from '@/lib/storage'
import { navigationSchema } from '@/app/navigation'
describe('domain and persistence boundaries', () => {
  it('validates all reference fixtures', () => {
    expect(articlesSchema.parse(ARTS0)).toEqual(ARTS0)
    expect(collectionsSchema.parse(COLS0)).toEqual(COLS0)
    expect(tagsSchema.parse(TAGS0)).toEqual(TAGS0)
  })
  it('rejects malformed persisted data and falls back safely', () => {
    for (const raw of ['{', '{}', '[{}]', 'null'])
      expect(readStored({ getItem: () => raw }, 'arts', ARTS0, articlesSchema)).toBe(ARTS0)
  })
  it('recovers from denied storage access', () => {
    expect(
      readStored(
        {
          getItem: () => {
            throw new Error('denied')
          },
        },
        'arts',
        ARTS0,
        articlesSchema,
      ),
    ).toBe(ARTS0)
  })
  it('normalizes malformed URL state', () => {
    const state = navigationSchema.parse({
      view: 'garbage',
      filters: { article: { range: 'invalid', sel: -1 }, site: null },
    })
    expect(state.view).toBe('lib')
    expect(state.filters.article.range).toBe('all')
    expect(state.filters.article.sel).toBeNull()
  })
  it('preserves date boundaries, tag matching and attention semantics', () => {
    expect(inRange(ARTS0[0], '1')).toBe(false)
    expect(inRange(ARTS0[1], '1')).toBe(true)
    expect(ruleMatch(['LoRA', 'missing'], 'all', ARTS0[0])).toBe(false)
    expect(ruleMatch(['LoRA', 'missing'], 'any', ARTS0[0])).toBe(true)
    expect(needsAttention(ARTS0.find((a) => a.id === 16)!)).toBe(true)
  })
})
