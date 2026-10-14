import { ClassificationStatus } from './classification-status'
import { contentLanguageLabel, savedDateLabel } from '@/domain/library'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { useEffect, useRef, useState } from 'react'

import { relatedSites, type Article, type Collection, type Dim, type Tag } from '@/domain/library'

import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import type { Update } from '@/features/library/types'

import { Label } from '@/components/ui/section-label'

import { Inspector } from '@/features/library/components/inspector'
import { ArticleContent } from './article-content'

export function Reader({
  a,
  arts,
  tags,
  cols,
  update,
  dimOf,
  setSel,
  allArts,
  openItem,
}: {
  allArts: Article[]
  openItem: (id: number, fromId?: number) => void
  a: Article
  arts: Article[]
  tags: Tag[]
  cols: Collection[]
  update: Update
  dimOf: (n: string) => Dim
  setSel: (id: number | null) => void
}) {
  const { t: translate } = useTranslation()

  const [raw, setRaw] = useState(false)
  const [insp, setInsp] = useState(typeof window === 'undefined' || window.innerWidth >= 1360)
  const progressBar = useRef<HTMLDivElement>(null)
  const idx = arts.findIndex((x) => x.id === a.id)
  const sites = relatedSites(a, allArts)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[role="dialog"]')) return
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.key === 'Escape') setSel(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setSel])

  return (
    <div className="h-full min-h-0 flex-1 flex relative overflow-hidden">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="h-12 shrink-0 flex items-center gap-1 px-4 border-b border-g-line relative overflow-x-auto scroll-quiet whitespace-nowrap [&>*]:shrink-0">
          <button
            onClick={() => setSel(null)}
            title={translate('library:backToOverviewEsc')}
            aria-label={translate('library:backToOverview')}
            className="h-8 px-3 rounded-full text-[13px] text-g-sub hover:bg-g-surface inline-flex items-center gap-1"
          >
            <Icon d="M15 6l-6 6 6 6" className="w-4 h-4" /> {translate('library:overview')}
          </button>
          <span className="text-[12px] text-g-sub tabular-nums ml-1" aria-live="polite">
            {idx + 1} / {arts.length}
          </span>
          <button
            disabled={idx <= 0}
            onClick={() => setSel(arts[idx - 1].id)}
            aria-label={translate('library:previousItem')}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-g-surface disabled:opacity-30"
          >
            <Icon d="M6 15l6-6 6 6" className="w-4 h-4" />
          </button>
          <button
            disabled={idx >= arts.length - 1}
            onClick={() => setSel(arts[idx + 1].id)}
            aria-label={translate('library:nextItem')}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-g-surface disabled:opacity-30"
          >
            <Icon d="M6 9l6 6 6-6" className="w-4 h-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {(!a.failed || a.sourceAvailable) && a.kind === 'article' && (
              <div className="flex rounded-full bg-g-surface p-0.5 text-[12.5px]">
                {[
                  [false, translate('library:reader')],
                  [true, translate('library:originalSnapshot')],
                ].map(([v, l]) => (
                  <button
                    key={String(l)}
                    onClick={() => setRaw(v as boolean)}
                    aria-pressed={raw === v}
                    className={`h-7 px-3.5 rounded-full transition ${raw === v ? 'bg-white shadow-sm font-medium' : 'text-g-sub'}`}
                  >
                    {l as string}
                  </button>
                ))}
              </div>
            )}
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12.5px] text-g-blue font-medium hover:bg-g-tint"
            >
              {a.kind === 'site' ? translate('library:visitWebsite') : translate('library:originalPage')}{' '}
              <Icon d={P.ext} className="w-3.5 h-3.5" />
            </a>
            {(!a.failed || a.sourceAvailable) && (
              <button
                onClick={() => setInsp((v) => !v)}
                aria-pressed={insp}
                className={`h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12.5px] font-medium ${insp ? 'bg-g-tint text-g-blue-dark' : 'text-g-sub hover:bg-g-surface'}`}
              >
                <Icon d={P.edit} className="w-3.5 h-3.5" /> {translate('library:organize')}
              </button>
            )}
          </div>
          <div ref={progressBar} className="absolute left-0 bottom-[-1px] h-0.5 bg-g-blue" style={{ width: '0%' }} />
        </div>

        <div
          data-testid="reader-scroll"
          className="flex-1 min-h-0 overflow-y-auto scroll-quiet"
          onScroll={(e) => {
            const el = e.currentTarget
            if (progressBar.current)
              progressBar.current.style.width =
                (el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)) * 100 + '%'
          }}
        >
          <article className="max-w-[720px] mx-auto px-10 pt-14 pb-32 rise">
            <div className="text-[12.5px] text-g-sub">
              <span className="text-g-green">{a.source}</span> · {savedDateLabel(a.date)} ·{' '}
              {contentLanguageLabel(a.lang)}
            </div>
            <h1 className="text-[34px] leading-[1.28] font-semibold mt-3 text-balance">{a.title}</h1>
            {sites.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="text-g-sub">{translate('library:relatedSavedWebsites')}</span>
                {sites.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openItem(s.id, a.id)}
                    className="h-7 pl-1.5 pr-3 rounded-full border border-g-line hover:bg-g-tint inline-flex items-center gap-1.5 font-medium"
                  >
                    <span
                      className="w-4 h-4 rounded grid place-items-center text-[10px] font-serif text-white"
                      style={{ background: s.site?.brand ?? '#0b57d0' }}
                    >
                      {s.title.charAt(0)}
                    </span>
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            <ClassificationStatus article={a} />
            {a.failed && !a.sourceAvailable ? (
              <div className="mt-8 rounded-xl bg-g-paper border border-g-line p-6">
                <div className="font-serif text-[18px] font-medium">
                  {a.kind === 'site'
                    ? translate('library:couldNotRetrieveThisWebsiteSInformation')
                    : translate('library:couldNotCaptureThisArticleSContent')}
                </div>
                <p className="text-[13.5px] text-g-sub mt-1.5 leading-relaxed">
                  {translate('library:thePageMayRequireSignInOrJavascript', {
                    summaryType:
                      a.kind === 'site' ? translate('library:anIntroduction') : translate('library:aSummary'),
                  })}
                </p>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 h-9 px-4 rounded-full bg-g-blue text-white text-[14px] font-medium inline-flex items-center gap-1.5 hover:bg-g-blue-dark"
                >
                  {translate('library:openOriginalPage')}
                  <Icon d={P.ext} className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <>
                <aside className="mt-8 py-4 pl-5 pr-5 border-l-2 border-g-blue bg-g-paper rounded-r-xl">
                  <div className="text-[12px] font-medium tracking-[.14em] text-g-blue-dark">
                    {a.kind === 'site' ? translate('library:about') : translate('library:abstract')}
                  </div>
                  <p className="font-serif text-[16px] leading-[1.8] mt-1.5 text-[#2b2b2b]">{a.summary}</p>
                </aside>
                {a.kind === 'site' ? (
                  <section className="mt-8">
                    <Label>{translate('library:siteHighlights')}</Label>
                    <ul className="border-t border-g-line">
                      {a.body.map((t, i) => (
                        <li key={i} className="flex gap-3 py-3 border-b border-g-line text-[15px] leading-relaxed">
                          <span className="font-mono text-[12px] text-g-sub pt-1.5">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : raw ? (
                  <pre className="mt-8 whitespace-pre-wrap font-mono text-[12.5px] leading-[1.8] text-g-sub bg-g-surface rounded-xl p-5">
                    {a.raw}
                  </pre>
                ) : (
                  <ArticleContent article={a} />
                )}
              </>
            )}
          </article>
        </div>
      </div>

      {insp && (!a.failed || a.sourceAvailable) && (
        <Inspector a={a} tags={tags} cols={cols} update={update} dimOf={dimOf} close={() => setInsp(false)} />
      )}
    </div>
  )
}
