import { changeLocale, locales, resolveLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
export function LanguageSelect({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation('common')
  return (
    <section className={`rounded-2xl border border-g-line bg-white p-6 ${className}`}>
      <label htmlFor="interface-language" className="block text-[17px] font-medium font-serif">
        {t('interfaceLanguage')}
      </label>
      <p className="text-[12.5px] text-g-sub mt-1.5 leading-relaxed">{t('languageHint')}</p>
      <div className="relative mt-5">
        <select
          id="interface-language"
          value={resolveLocale(i18n.resolvedLanguage)}
          onChange={(event) => {
            void changeLocale(resolveLocale(event.target.value))
          }}
          className="w-full h-10 pl-3 text-[14px] focus:border-g-text outline-none"
        >
          {Object.entries(locales).map(([code, locale]) => (
            <option key={code} value={code}>
              {locale.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
