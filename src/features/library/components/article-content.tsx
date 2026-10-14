import { lazy, Suspense } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Article } from '@/domain/library'
import { ImageViewer } from '@/components/media/image-viewer'
import { loadMediaPlayer } from '@/components/media/media-loader'
import { useAppTranslation } from '@/i18n/use-translation'
import { apiPath, GO_BACKEND } from '@/api/production-mode'
import { mediaPath } from '@/design/media'

const MediaPlayer = lazy(loadMediaPlayer)
const archivedImage = /^\/api\/images\/enrichment(?:\/|%2f)[1-9]\d*(?:\/|%2f)[a-f0-9]{64}\.(?:jpg|png|webp|gif|avif)$/i
export function ArticleContent({ article }: { article: Article }) {
  const { t } = useAppTranslation()
  const text = article.body.join('\n\n')
  const images = article.images ?? []
  const referenced = new Set([...text.matchAll(/cairn-image:(\d+)/g)].map((m) => Number(m[1])))
  const renderImage = (index: number, alt?: string) => {
    const src = images[index]?.src
    const label = alt || t('library:articleImage', { number: index + 1 })
    return src && (archivedImage.test(src) || (GO_BACKEND && /^\/api\/media\/[a-f0-9]{32}$/.test(src))) ? (
      <ImageViewer key={index} src={mediaPath(apiPath(src))} alt={label} />
    ) : (
      <span className="block text-g-sub font-sans text-[13px]">{t('library:imageUnavailable')}</span>
    )
  }
  return (
    <>
      <div className="reader-content mt-10 font-serif text-[17.5px] leading-[1.95] space-y-5 text-[#222] break-words">
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          urlTransform={(url, key) => (key === 'src' && /^cairn-image:\d+$/.test(url) ? url : defaultUrlTransform(url))}
          components={{
            img: ({ src, alt }) =>
              typeof src === 'string' && /^cairn-image:\d+$/.test(src) ? (
                renderImage(Number(src.slice(12)), alt)
              ) : (
                <span className="text-g-sub">{t('library:imageUnavailable')}</span>
              ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-g-blue underline underline-offset-[3px] decoration-g-blue/40 hover:decoration-g-blue"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {text}
        </Markdown>
        {images.map((_, index) => (referenced.has(index) ? null : renderImage(index)))}
      </div>
      {!!article.media?.length && (
        <section className="mt-8 space-y-5" aria-label={t('library:articleMedia')}>
          {article.media.map((media) => {
            const title = media.title || t(media.kind === 'audio' ? 'library:audio' : 'library:video')
            if (media.status !== 'ready')
              return (
                <p key={media.id} className="text-[13px] text-g-sub">
                  {title} · {t('library:mediaPending')}
                </p>
              )
            const src = mediaPath(apiPath(`/api/media/${media.id}`))
            if (media.content_type === 'application/zip')
              return (
                <a key={media.id} href={src} download className="block text-g-blue">
                  {title} · {t('library:downloadMedia')}
                </a>
              )
            return (
              <Suspense key={media.id} fallback={<p role="status">{t('common:liveLoading')}</p>}>
                <MediaPlayer src={src} kind={media.kind} title={title} />
              </Suspense>
            )
          })}
        </section>
      )}
    </>
  )
}
