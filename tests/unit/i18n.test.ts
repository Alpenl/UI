import { afterEach, describe, expect, it } from 'vitest'
import i18n, { changeLocale, defaultLocale, formatDate, locales, resolveLocale, t } from '@/i18n'
import { localizeDimensions } from '@/features/tags/localize-dimensions'
import { DIMS0 } from '@/domain/library'
afterEach(async () => {
  await changeLocale(defaultLocale)
})
describe('language contract', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['zh-CN', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['fr', 'zh-CN'],
    [null, 'zh-CN'],
  ])('resolves %s to %s', (input, expected) => {
    expect(resolveLocale(input)).toBe(expected)
  })
  it('requires every locale to implement the same namespaces and keys', () => {
    const canonicalKeys = (resource: Record<string, string>) =>
      [...new Set(Object.keys(resource).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, '')))].sort()
    for (const [code, locale] of Object.entries(locales)) {
      expect(Object.keys(locale.resources).sort()).toEqual(Object.keys(locales[defaultLocale].resources).sort())
      for (const ns of Object.keys(
        locales[defaultLocale].resources,
      ) as (keyof (typeof locales)['zh-CN']['resources'])[]) {
        expect(canonicalKeys(locale.resources[ns])).toEqual(canonicalKeys(locales[defaultLocale].resources[ns]))
        for (const value of Object.values(locale.resources[ns])) expect(value.trim()).not.toBe('')
        for (const key of Object.keys(locale.resources[ns]).filter((key) => key.endsWith('_other'))) {
          for (const category of new Intl.PluralRules(code).resolvedOptions().pluralCategories)
            expect(locale.resources[ns]).toHaveProperty(key.replace(/_other$/, `_${category}`))
        }
      }
    }
  })
  it('handles English plurals and interpolation', async () => {
    await changeLocale('en')
    expect(t('sites:websites', { count: 1 })).toBe('1 website')
    expect(t('sites:websites', { count: 2 })).toBe('2 websites')
    expect(t('library:events', { count: 1 })).toBe('1 event')
    expect(t('app:tagAlreadyExists', { name: '<test>' })).toBe('Tag “<test>” already exists')
  })
  it('formats dates using the active language', async () => {
    await changeLocale('en')
    expect(formatDate(new Date(2026, 9, 12))).toBe('October 12')
    await changeLocale('zh-CN')
    expect(formatDate(new Date(2026, 9, 12))).toBe('10 月 12 日')
    expect(formatDate(new Date(2026, 9, 12), { month: 'short' })).toBe('10 月')
  })
  it('translates untouched built-in labels without changing user content or identity', async () => {
    await changeLocale('en')
    expect(localizeDimensions(DIMS0)[0]).toMatchObject({ id: 'topic', label: 'Topic' })
    expect(localizeDimensions([{ ...DIMS0[0], label: '我的主题' }])[0].label).toBe('我的主题')
    expect(DIMS0[0].label).toBe('主题')
    expect(i18n.resolvedLanguage).toBe('en')
  })
})
