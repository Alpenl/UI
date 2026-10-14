import { checkedLabel, pricingLabel, savedDateLabel } from '@/domain/library'
import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { domainOf, relatedArticles, type Article } from '@/domain/library'

import { Icon } from '@/components/ui/icon'
import { P } from '@/components/ui/icons'

import { OrganizeBody } from '@/features/library/components/organize-body'
import { type LibProps } from '@/features/library/types'

import { Tile } from '@/features/sites/components/site-tile'

import { StatusPill } from '@/features/sites/components/status-pill'

import { Fact } from '@/components/ui/fact'

import { brandOf } from '@/features/sites/components/site-tile'

export function Drawer({
  a,
  allArts,
  tags,
  cols,
  update,
  dimOf,
  close,
  openItem,
  backToArticle,
}: LibProps & { a: Article; close: () => void }) {
  const { t: translate } = useTranslation()

  const dom = domainOf(a)
  const dead = a.site?.status === 'dead'
  const related = relatedArticles(a, allArts)
  return (
    <aside
      aria-label={translate('sites:details', { name: a.title })}
      className="w-[400px] shrink-0 h-full bg-white border-l border-g-line overflow-y-auto scroll-quiet slide-in z-10 max-[1280px]:absolute max-[1280px]:right-0 max-[1280px]:top-0 max-[1280px]:shadow-[-12px_0_28px_rgba(0,0,0,.1)] max-[520px]:w-full"
    >
      <div className="relative">
        <Tile a={a} big />
        <button
          onClick={close}
          aria-label={translate('sites:close')}
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-white/90 text-g-text hover:bg-white shadow-sm"
        >
          <Icon d={P.x} className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 pt-5 pb-8">
        {backToArticle && (
          <button
            onClick={backToArticle}
            className="mb-3 h-8 -ml-2 pl-2 pr-3 rounded-full text-[13px] text-g-blue hover:bg-g-tint inline-flex items-center gap-1 font-medium"
          >
            <Icon d="M15 6l-6 6 6 6" className="w-4 h-4" /> {translate('sites:backToArticle')}
          </button>
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] font-semibold leading-tight">{a.title}</h2>
            <div className="text-[12.5px] text-g-green mt-1 truncate">{a.url.replace(/^https?:\/\//, '')}</div>
          </div>
          <StatusPill a={a} />
        </div>

        <a
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 w-full h-11 rounded-full bg-g-blue text-white text-[14.5px] font-medium inline-flex items-center justify-center gap-2 hover:bg-g-blue-dark hover:shadow-sm transition"
        >
          {translate('library:visitWebsite')}
          <Icon d={P.ext} className="w-4 h-4" />
        </a>

        {a.site && (
          <div className="mt-5 grid grid-cols-3 divide-x divide-g-line border border-g-line rounded-xl">
            <Fact label={translate('sites:availability')}>
              <span className={`inline-flex items-center gap-1.5 ${dead ? 'text-g-red' : 'text-g-green'}`}>
                <span className={`w-2 h-2 rounded-full ${dead ? 'bg-g-red' : 'bg-g-ok'}`} />
                {dead ? translate('sites:unavailable') : translate('sites:available')}
              </span>
            </Fact>
            <Fact label={translate('sites:pricing')}>{pricingLabel(a.site.pricing)}</Fact>
            <Fact label={translate('sites:savedArticles')}>
              <span className="tabular-nums">{related.length}</span>
            </Fact>
          </div>
        )}
        {a.site && (
          <p className="text-[12px] text-g-sub mt-2">
            {translate('sites:lastCheckedSaved', {
              checkedAt: checkedLabel(a.site.checked),
              savedAt: savedDateLabel(a.date),
            })}
            {dead && (
              <span className="block text-g-red mt-0.5">
                {translate('sites:unavailableInTheLastThreeChecksConsiderArchiving')}
              </span>
            )}
          </p>
        )}

        {a.failed ? (
          <div className="mt-6 rounded-xl bg-g-paper border border-g-line p-5">
            <div className="font-serif text-[16px] font-medium">
              {translate('sites:siteInformationHasNotBeenCaptured')}
            </div>
            <p className="text-[13px] text-g-sub mt-1.5 leading-relaxed">
              {translate('sites:openThisWebsiteAndUseTheBrowserExtension')}
            </p>
          </div>
        ) : (
          <>
            <section className="mt-7">
              <div className="text-[12px] font-medium tracking-[.12em] text-g-sub mb-2">
                {translate('library:anIntroduction')}
              </div>
              <p className="font-serif text-[15.5px] leading-[1.8] text-g-text">{a.summary}</p>
            </section>
            <section className="mt-6">
              <div className="text-[12px] font-medium tracking-[.12em] text-g-sub mb-2">
                {translate('sites:whatItOffers')}
              </div>
              <ul className="space-y-2">
                {a.body.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                    <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: brandOf(a) }} />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
            <section className="mt-7">
              <div className="text-[12px] font-medium tracking-[.12em] text-g-sub mb-2">
                {translate('sites:relatedArticles', { count: related.length })}
              </div>
              {related.length === 0 ? (
                <p className="text-[12.5px] text-g-sub">{translate('sites:noSavedArticlesFromThisSiteYet')}</p>
              ) : (
                <ul className="border-t border-g-line">
                  {related.map((r) => (
                    <li key={r.id} className="border-b border-g-line">
                      <button
                        onClick={() => openItem(r.id)}
                        className="w-full text-left py-2.5 hover:bg-g-paper -mx-2 px-2 rounded transition"
                      >
                        <div className="font-serif text-[14px] leading-snug">{r.title}</div>
                        <div className="text-[12px] text-g-sub mt-0.5">
                          {savedDateLabel(r.date)} ·{' '}
                          {domainOf(r) === dom
                            ? translate('sites:articleFromThisSite')
                            : translate('sites:articleReferencesThisSite')}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {!a.failed && (
        <div className="border-t border-g-line bg-g-paper">
          <div className="px-5 pt-4 text-[13px] font-semibold">{translate('library:organize')}</div>
          <OrganizeBody {...{ a, tags, cols, update, dimOf }} />
        </div>
      )}
    </aside>
  )
}
