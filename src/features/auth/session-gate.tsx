import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DESIGN, GO_BACKEND } from '@/api/production-mode'
import { sessionRequest } from '@/api/session'
import { Btn } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'
import { LanguageSelect } from '@/features/settings/components/language-select'

export function SessionGate({ children }: { children: ReactNode }) {
  if (DESIGN || !GO_BACKEND) return children
  return <PrivateSession>{children}</PrivateSession>
}
function PrivateSession({ children }: { children: ReactNode }) {
  const { t } = useAppTranslation()
  const query = useQuery({
    queryKey: ['browser-session'],
    queryFn: () => sessionRequest('GET'),
    retry: false,
    staleTime: Infinity,
  })
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const expired = () => window.location.reload()
    window.addEventListener('cairn:session-expired', expired)
    return () => window.removeEventListener('cairn:session-expired', expired)
  }, [])
  const login = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await sessionRequest('POST', password)
      setPassword('')
      await query.refetch()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'connection_failed')
    } finally {
      setSaving(false)
    }
  }
  if (query.data) return children
  return (
    <main className="min-h-dvh overflow-y-auto bg-g-surface grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-g-line bg-white p-8 space-y-8">
        <div>
          <h1 className="font-serif text-[36px]">Cairn</h1>
          <p className="text-g-sub text-[14px] mt-2">{t('common:signInHint')}</p>
        </div>
        {query.isPending ? (
          <p role="status">{t('common:checkingSession')}</p>
        ) : query.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-g-red">
              {t('common:liveLoadError')}
            </p>
            <Btn kind="outline" onClick={() => void query.refetch()}>
              {t('common:retryRead')}
            </Btn>
          </div>
        ) : (
          <form onSubmit={(event) => void login(event)} className="space-y-4">
            <label className="block text-[14px]" htmlFor="cairn-password">
              {t('common:password')}
            </label>
            <input
              id="cairn-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full h-11 rounded-xl border border-g-line px-3 outline-none focus:border-g-blue"
            />
            {error && (
              <p role="alert" className="text-g-red text-[13px]">
                {t(
                  error === 'rate_limited'
                    ? 'common:loginRateLimited'
                    : error === 'invalid_password'
                      ? 'common:invalidPassword'
                      : 'common:liveLoadError',
                )}
              </p>
            )}
            <Btn type="submit" kind="primary" disabled={saving || !password} className="w-full justify-center">
              {t(saving ? 'common:signingIn' : 'common:signIn')}
            </Btn>
          </form>
        )}
        <LanguageSelect />
      </div>
    </main>
  )
}
