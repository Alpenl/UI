import { useAppTranslation } from '@/i18n/use-translation'
import type { LibProps } from '@/features/library/types'

import { ArticleList } from '@/features/library/components/article-list'

import { lazy, Suspense } from 'react'

import { loadReader } from '../reader-loader'
const Reader = lazy(loadReader)

import { Overview } from '@/features/library/components/overview'

export function Workspace(p: LibProps) {
  const { t } = useAppTranslation()
  const a = p.arts.find((x) => x.id === p.sel) ?? null
  return (
    <div className="h-full min-h-0 overflow-hidden grid grid-rows-[minmax(0,1fr)] grid-cols-[372px_1fr] max-[900px]:grid-cols-1">
      <div className={`min-w-0 min-h-0 h-full ${a || p.sel ? 'max-[900px]:hidden' : ''}`}>
        <ArticleList {...p} />
      </div>
      <div className={`min-w-0 min-h-0 h-full flex flex-col bg-white ${a || p.sel ? '' : 'max-[900px]:hidden'}`}>
        {p.sel && (p.reading || p.readingError || !a) ? (
          <div className="p-10" role="status">
            <button className="text-g-blue mb-8" onClick={() => p.setSel(null)}>
              {t('library:backToOverview')}
            </button>
            <p>{t(p.readingError ? 'common:liveLoadError' : 'common:loadingArticle')}</p>
            {p.readingError && <button onClick={p.retryReading}>{t('common:retryRead')}</button>}
          </div>
        ) : a ? (
          <Suspense
            fallback={
              <div className="p-10" role="status">
                {t('common:loadingResults')}
              </div>
            }
          >
            {p.readingRefreshError && (
              <div role="alert" className="px-6 py-2 text-[12px] text-g-sub">
                {t('common:refreshFailed')}{' '}
                <button className="text-g-blue" onClick={p.retryReading}>
                  {t('common:retryRead')}
                </button>
              </div>
            )}
            <Reader key={a.id} a={a} {...p} />
          </Suspense>
        ) : p.loadingError ? (
          <div className="p-10 text-g-sub" role="alert">
            <p>{t('common:liveLoadError')}</p>
            <button className="mt-3 text-g-blue" onClick={p.retryLoading}>
              {t('common:retryRead')}
            </button>
          </div>
        ) : p.loading ? (
          <div className="p-10" role="status">
            {t('common:loadingResults')}
          </div>
        ) : (
          <Overview {...p} />
        )}
      </div>
    </div>
  )
}
