import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/api/production'
import { useAppTranslation } from '@/i18n/use-translation'
import { StatusRow } from '@/components/ui/status-row'
import { Btn } from '@/components/ui/button'
import { LanguageSelect } from './language-select'
import { DESIGN, GO_BACKEND } from '@/api/production-mode'
import { sessionRequest } from '@/api/session'
import { useState } from 'react'
const schema = z.object({
  counts: z.object({
    pending: z.number(),
    processing: z.number(),
    completed: z.number(),
    failed: z.number(),
    exhausted: z.number(),
  }),
})
export function LiveSettings() {
  const { t } = useAppTranslation()
  const [logoutError, setLogoutError] = useState(false)
  const query = useQuery({
    queryKey: ['live-status'],
    queryFn: () => request('/api/overview', schema),
    refetchInterval: 60000,
  })
  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-10">
        <div>
          <h1 className="text-[28px] font-normal">{t('admin:settingsStatus')}</h1>
          <p className="text-[14px] text-g-sub mt-1">
            {t(
              DESIGN
                ? 'common:designReadOnly'
                : GO_BACKEND
                  ? 'common:liveIndependentBackend'
                  : 'common:liveSharedBackend',
            )}
          </p>
        </div>
        <LanguageSelect />
        <section>
          <h2 className="text-[16px] font-medium">{t('admin:connectionCredentials')}</h2>
          <div className="mt-2 border-y border-g-line">
            <StatusRow
              ok={query.isSuccess}
              title={t('admin:cloudStorage')}
              sub={
                query.isPending
                  ? t('common:liveLoading')
                  : query.isError
                    ? t('common:liveLoadError')
                    : t(DESIGN ? 'common:designLocal' : 'common:liveConnected')
              }
            />
          </div>
          <p className="text-[13px] text-g-sub mt-4">
            {t(DESIGN ? 'common:designReadOnly' : 'common:liveCredentials')}
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-medium">{t('admin:backgroundQueue')}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                ['admin:queued', query.data ? query.data.counts.pending + query.data.counts.processing : '—'],
                ['common:liveFailed', query.data ? query.data.counts.failed + query.data.counts.exhausted : '—'],
                ['admin:completed', query.data?.counts.completed ?? '—'],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-g-line p-4">
                <dd className="text-[32px] leading-none tabular-nums">{value}</dd>
                <dt className="text-[13px] text-g-sub mt-2">{t(key)}</dt>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl bg-g-surface p-5">
          <p className="text-[13px] text-g-sub mb-4">
            {t(DESIGN ? 'common:designReadOnly' : GO_BACKEND ? 'common:goCapabilities' : 'common:liveCapabilities')}
          </p>
          <Btn
            kind="primary"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
          >
            {t('admin:checkServiceConnection')}
          </Btn>
        </section>
        {GO_BACKEND && !DESIGN && (
          <Btn
            kind="outline"
            onClick={() => {
              setLogoutError(false)
              void sessionRequest('DELETE')
                .then(() => window.location.reload())
                .catch(() => setLogoutError(true))
            }}
          >
            {t('common:signOut')}
          </Btn>
        )}
        {logoutError && (
          <p role="alert" className="text-g-red">
            {t('common:liveLoadError')}
          </p>
        )}
      </div>
    </div>
  )
}
