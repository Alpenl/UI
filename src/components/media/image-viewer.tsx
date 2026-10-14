import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useAppTranslation } from '@/i18n/use-translation'

/** An archived image with a keyboard-accessible, focus-trapped preview. */
export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const { t } = useAppTranslation()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [zoom, setZoom] = useState(false)
  return (
    <span className="block my-5 font-sans text-[13px] leading-normal">
      {failed ? (
        <span role="status" className="block rounded-xl border border-g-line bg-g-paper p-5 text-g-sub">
          {t('library:imageUnavailable')}{' '}
          <button
            className="text-g-blue underline"
            onClick={() => {
              setAttempt((n) => n + 1)
              setFailed(false)
            }}
          >
            {t('library:retryMedia')}
          </button>
        </span>
      ) : (
        <Dialog.Root onOpenChange={() => setZoom(false)}>
          <Dialog.Trigger asChild>
            <button
              className="block w-full cursor-zoom-in rounded-xl overflow-hidden bg-g-paper"
              aria-label={t('library:enlargeImage', { alt })}
            >
              <img
                key={attempt}
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className="block w-full max-h-[70dvh] object-contain min-h-16"
              />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-3 z-50 flex min-h-0 flex-col rounded-xl bg-g-paper shadow-xl outline-none"
            >
              <div className="flex shrink-0 items-center gap-4 border-b border-g-line p-3 text-[14px]">
                <Dialog.Title className="min-w-0 flex-1 truncate font-medium">{alt}</Dialog.Title>
                <button onClick={() => setZoom((v) => !v)} aria-pressed={zoom} className="text-g-blue">
                  {t(zoom ? 'library:fitImage' : 'library:actualImageSize')}
                </button>
                <Dialog.Close className="rounded-full border border-g-line px-4 py-1.5">
                  {t('library:closeMedia')}
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
                <img src={src} alt={alt} className={zoom ? 'max-w-none mx-auto' : 'w-full h-full object-contain'} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </span>
  )
}
