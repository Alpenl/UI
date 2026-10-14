import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enAdmin from './locales/en/admin.json'
import enApp from './locales/en/app.json'
import enCommon from './locales/en/common.json'
import enDomain from './locales/en/domain.json'
import enLibrary from './locales/en/library.json'
import enSites from './locales/en/sites.json'
import zhAdmin from './locales/zh/admin.json'
import zhApp from './locales/zh/app.json'
import zhCommon from './locales/zh/common.json'
import zhDomain from './locales/zh/domain.json'
import zhLibrary from './locales/zh/library.json'
import zhSites from './locales/zh/sites.json'

export const locales = {
  'zh-CN': {
    name: '简体中文',
    direction: 'ltr',
    resources: { app: zhApp, library: zhLibrary, sites: zhSites, admin: zhAdmin, common: zhCommon, domain: zhDomain },
  },
  en: {
    name: 'English',
    direction: 'ltr',
    resources: { app: enApp, library: enLibrary, sites: enSites, admin: enAdmin, common: enCommon, domain: enDomain },
  },
} as const
export type Locale = keyof typeof locales
export const defaultLocale: Locale = 'zh-CN'
export function resolveLocale(value: string | null | undefined): Locale {
  const normalized = value?.toLowerCase()
  return (
    (Object.keys(locales) as Locale[]).find((key) => key.toLowerCase() === normalized) ??
    (Object.keys(locales) as Locale[]).find((key) => key.split('-')[0] === normalized?.split('-')[0]) ??
    defaultLocale
  )
}
function initialLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  try {
    return resolveLocale(localStorage.getItem('cairn-ui:locale') ?? navigator.language)
  } catch {
    return resolveLocale(navigator.language)
  }
}
function syncDocument(language: string) {
  if (typeof document === 'undefined') return
  const locale = resolveLocale(language)
  document.documentElement.lang = locale
  document.documentElement.dir = locales[locale].direction
  try {
    localStorage.setItem('cairn-ui:locale', locale)
  } catch {
    /* Storage is optional. */
  }
}
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(locales).map(([key, value]) => [key, value.resources])),
  lng: initialLocale(),
  fallbackLng: defaultLocale,
  supportedLngs: Object.keys(locales),
  defaultNS: 'app',
  ns: Object.keys(locales[defaultLocale].resources),
  interpolation: { escapeValue: false },
  initImmediate: false,
})
i18n.on('languageChanged', syncDocument)
syncDocument(i18n.language)
export const t = i18n.t.bind(i18n)
export const changeLocale = (locale: Locale) => i18n.changeLanguage(locale)
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
export function formatDate(
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' },
) {
  const locale = resolveLocale(i18n.resolvedLanguage)
  const normalized =
    locale === 'zh-CN' && options.month && !options.day ? { ...options, month: 'numeric' as const } : options
  const key = JSON.stringify([locale, normalized])
  let formatter = dateFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, normalized)
    if (dateFormatters.size >= 32) dateFormatters.delete(dateFormatters.keys().next().value!)
    dateFormatters.set(key, formatter)
  }
  if (resolveLocale(i18n.resolvedLanguage) === 'zh-CN' && options.month && !options.weekday && !options.year)
    return formatter
      .formatToParts(value)
      .map((part) => part.value.trim())
      .filter(Boolean)
      .join(' ')
  return formatter.format(value)
}
export function formatNumber(value: number) {
  return new Intl.NumberFormat(i18n.resolvedLanguage ?? defaultLocale).format(value)
}
export default i18n
