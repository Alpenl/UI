import { useAppTranslation } from '@/i18n/use-translation'
import type { Tag } from '@/domain/library'

export function ClassificationFields({
  label,
  value,
  description,
  changeClass,
  onChange,
}: {
  label: string
  value: string
  description: string
  changeClass?: Tag['changeClass']
  onChange: (patch: { aiLabel?: string; desc?: string; changeClass?: Tag['changeClass'] }) => void
}) {
  const { t } = useAppTranslation()
  const input =
    'mt-1 min-w-0 w-full rounded-lg border border-g-line bg-white p-3 text-[14px] text-g-text focus:border-g-blue outline-none'
  return (
    <div className="grid min-w-0 [&>*]:min-w-0 gap-3 text-[12px] text-g-sub">
      <p>{t('admin:classificationHint')}</p>
      <label>
        {t('admin:classificationName')}
        <input
          className={input}
          maxLength={100}
          value={value}
          onChange={(e) => onChange({ aiLabel: e.target.value, changeClass: undefined })}
        />
      </label>
      {label !== value && (
        <button
          type="button"
          className="text-left text-g-blue"
          onClick={() => onChange({ aiLabel: label, changeClass: undefined })}
        >
          {t('admin:useDisplayName')}
        </button>
      )}
      <label>
        {t('admin:classificationDefinition')}
        <textarea
          className={input}
          rows={3}
          maxLength={8000}
          value={description}
          onChange={(e) => onChange({ desc: e.target.value, changeClass: undefined })}
        />
      </label>
      <label>
        {t('admin:classificationChange')}
        <select
          className={input}
          value={changeClass ?? ''}
          onChange={(e) => onChange({ changeClass: (e.target.value || undefined) as Tag['changeClass'] })}
        >
          <option value="">{t('admin:chooseClassificationChange')}</option>
          <option value="wording">{t('admin:changeWording')}</option>
          <option value="broader">{t('admin:changeBroader')}</option>
          <option value="narrower">{t('admin:changeNarrower')}</option>
          <option value="redefined">{t('admin:changeRedefined')}</option>
        </select>
      </label>
    </div>
  )
}
