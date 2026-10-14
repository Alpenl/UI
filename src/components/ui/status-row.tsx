import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

export function StatusRow({ ok, title, sub }: { ok: boolean; title: string; sub: string }) {
  const { t: translate } = useTranslation()

  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-g-ok' : 'bg-g-amber'}`} />
      <div className="flex-1">
        <div className="text-[14px]">{title}</div>
        <div className="text-[12px] text-g-sub">{sub}</div>
      </div>
      <span className={`text-[13px] font-medium ${ok ? 'text-g-green' : 'text-g-warn'}`}>
        {ok ? translate('admin:connected') : translate('admin:retrying')}
      </span>
    </div>
  )
}
