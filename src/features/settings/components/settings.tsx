import { useAppTranslation as useTranslation } from '@/i18n/use-translation'
import { LanguageSelect } from './language-select'

import { useState } from 'react'

import { USAGE, queueStatus } from '@/domain/library'

import { Btn } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import { StatusRow } from '@/components/ui/status-row'

import { Meter } from '@/components/ui/usage-meter'

export function Settings({ online, setOnline }: { online: boolean; setOnline: (v: boolean) => void }) {
  const { t: translate } = useTranslation()

  const [token, setToken] = useState('demo_access_token')
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const qs = queueStatus(online)

  const recheck = () => {
    setChecking(true)
    setDone(null)
    setTimeout(() => {
      setChecking(false)
      setOnline(true)
      setDone(translate('admin:connectionRestored3SleepingTasksResumed'))
    }, 1400)
  }

  return (
    <div className="h-full overflow-y-auto scroll-quiet">
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-10">
        <div>
          <h1 className="text-[28px] font-normal">{translate('admin:settingsStatus')}</h1>
          <p className="text-[14px] text-g-sub mt-1">{translate('admin:everythingRunsAutomaticallyHereYouCanSeeIt')}</p>
        </div>

        <LanguageSelect />
        <section>
          <h2 className="text-[16px] font-medium">{translate('admin:connectionCredentials')}</h2>
          <div className="mt-2 divide-y divide-g-line border-y border-g-line">
            <StatusRow
              ok
              title={translate('admin:cloudStorage')}
              sub={translate('admin:workerD1Database42MsLatency')}
            />
            <StatusRow
              ok={online}
              title={translate('admin:browserCaptureExtension')}
              sub={
                online
                  ? translate('admin:chromeExtensionV142JustSynced')
                  : translate('admin:chromeExtensionV142LastSynced18')
              }
            />
          </div>
          <label className="block mt-4 text-[12px] text-g-sub">
            {translate('admin:accessToken')}
            <div className="mt-1 flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg border border-g-line text-[14px] text-g-text font-mono focus:border-g-blue outline-none"
              />
              <Btn kind="outline" onClick={() => setShow((v) => !v)}>
                {show ? translate('admin:hide') : translate('admin:show')}
              </Btn>
            </div>
          </label>
        </section>

        <section>
          <h2 className="text-[16px] font-medium">{translate('admin:todaySModelUsage')}</h2>
          <p className="text-[12px] text-g-sub mt-0.5">{translate('admin:tasksBeyondTheDailyLimitContinueTomorrow')}</p>
          <div className="mt-5 space-y-5">
            <Meter label={translate('admin:readingEnhancementSummaryTranslationCleanup')} {...USAGE.enhance} />
            <Meter label={translate('admin:classificationTagsCollections')} {...USAGE.classify} />
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-medium">{translate('admin:backgroundQueue')}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              [translate('admin:queued'), qs.queued, 'text-g-text'],
              [translate('admin:retrying'), qs.retry, 'text-g-warn'],
              [translate('admin:completed'), qs.done, 'text-g-green'],
            ].map(([l, n, c]) => (
              <div key={l as string} className="rounded-2xl border border-g-line p-4">
                <dd className={`text-[32px] leading-none tabular-nums ${c}`}>{n}</dd>
                <dt className="text-[13px] text-g-sub mt-2">{l}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl bg-g-surface p-5 flex items-center gap-4 max-[640px]:flex-col max-[640px]:items-stretch">
          <div className="flex-1">
            <div className="text-[15px] font-medium">{translate('admin:automaticRecovery')}</div>
            <p className="text-[13px] text-g-sub mt-0.5 leading-relaxed">
              {translate('admin:networkErrorsAndRateLimitsTriggerRetriesWith')}
              {done && (
                <span role="status" className="block text-g-green mt-1">
                  {done}
                </span>
              )}
            </p>
          </div>
          <Btn kind="primary" onClick={recheck} disabled={checking}>
            <Icon d={P.refresh} className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? translate('admin:checking') : translate('admin:checkServiceConnection')}
          </Btn>
        </section>
      </div>
    </div>
  )
}
