import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '@/api/production'
import { useAppTranslation } from '@/i18n/use-translation'
import { StatusRow } from '@/components/ui/status-row'
import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'
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
  const counts = query.data?.counts
  const queued = counts ? counts.pending + counts.processing : 0
  const failedN = counts ? counts.failed + counts.exhausted : 0
  const doneN = counts?.completed ?? 0
  const total = Math.max(1, queued + failedN + doneN)
  const stats = [
    { key: 'admin:queued', n: queued, color: 'text-g-text', bar: 'bg-g-blue' },
    {
      key: 'common:liveFailed',
      n: failedN,
      color: 'text-g-warn',
      bar: 'bg-g-amber',
    },
    { key: 'admin:completed', n: doneN, color: 'text-g-green', bar: 'bg-g-ok' },
  ] as const
  const card = 'rounded-2xl border border-g-line bg-white p-6'

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-4xl mx-auto px-8 pt-12 pb-20 rise">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[32px] font-semibold leading-tight">{t('admin:settingsStatus')}</h1>
            <p className="text-[14px] text-g-sub mt-2 max-w-[52ch] leading-relaxed">
              {t(
                DESIGN
                  ? 'common:designReadOnly'
                  : GO_BACKEND
                    ? 'common:liveIndependentBackend'
                    : 'common:liveSharedBackend',
              )}
            </p>
          </div>
          <Btn
            kind="primary"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
          >
            <Icon d={P.refresh} className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            {t('admin:checkServiceConnection')}
          </Btn>
        </header>

        <div className="mt-10 grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
          <LanguageSelect />
          <section className={card}>
            <h2 className="text-[17px] font-medium font-serif">{t('admin:connectionCredentials')}</h2>
            <div className="mt-2">
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
            {!DESIGN && <p className="text-[12.5px] text-g-sub mt-3 leading-relaxed">{t('common:liveCredentials')}</p>}
          </section>
        </div>

        <section className={`${card} mt-5`}>
          <h2 className="text-[17px] font-medium font-serif">{t('admin:backgroundQueue')}</h2>
          <div
            className="mt-5 h-1.5 rounded-[2px] bg-g-surface overflow-hidden flex"
            role="img"
            aria-label={stats.map((s) => `${t(s.key)} ${s.n}`).join(' · ')}
          >
            {stats.map((s) => (
              <div key={s.key} className={s.bar} style={{ width: (s.n / total) * 100 + '%' }} />
            ))}
          </div>
          <dl className="mt-6 grid grid-cols-3 divide-x divide-g-line">
            {stats.map((s, i) => (
              <div key={s.key} className={i === 0 ? 'pr-6' : 'px-6'}>
                <dd className={`font-serif text-[40px] leading-none tabular-nums ${s.color}`}>
                  {query.data ? s.n : '—'}
                </dd>
                <dt className="text-[13px] text-g-sub mt-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.bar}`} />
                  {t(s.key)}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        {!DESIGN && (
          <p className="text-[12.5px] text-g-sub mt-5 leading-relaxed">
            {t(GO_BACKEND ? 'common:goCapabilities' : 'common:liveCapabilities')}
          </p>
        )}
        <div className="mt-6 space-y-3 empty:hidden">
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
    </div>
  )
}
