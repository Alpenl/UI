import { changeLocale, locales, resolveLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
export function LanguageSelect() {
  const { t, i18n } = useTranslation('common')
  return (
    <section>
      <label htmlFor="interface-language" className="block text-[16px] font-medium font-serif">
        {t('interfaceLanguage')}
      </label>
      <p className="text-[12px] text-g-sub mt-1">{t('languageHint')}</p>
      <select
        id="interface-language"
        value={resolveLocale(i18n.resolvedLanguage)}
        onChange={(event) => {
          void changeLocale(resolveLocale(event.target.value))
        }}
        className="mt-3 h-10 px-3 rounded-lg border border-g-line bg-white text-[14px]"
      >
        {Object.entries(locales).map(([code, locale]) => (
          <option key={code} value={code}>
            {locale.name}
          </option>
        ))}
      </select>
    </section>
  )
}
