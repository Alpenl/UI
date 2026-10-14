import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  MediaController,
  MediaControlBar,
  MediaPlayButton,
  MediaTimeRange,
  MediaTimeDisplay,
  MediaMuteButton,
  MediaFullscreenButton,
  MediaPipButton,
  MediaPlaybackRateButton,
  MediaLoadingIndicator,
} from 'media-chrome/react'
import { MediaPlaybackRateMenu, MediaPlaybackRateMenuButton } from 'media-chrome/react/menu'
import 'media-chrome/dist/lang/zh-CN.js'
import { useAppTranslation } from '@/i18n/use-translation'
import './media-player.css'

type MediaPlayerProps = { src: string; kind: 'video' | 'audio'; title: string }

export function MediaPlayer(props: MediaPlayerProps) {
  // A different source must never inherit the previous video's size or error state.
  return <Playback key={`${props.kind}:${props.src}`} {...props} />
}

function Playback({ src, kind, title }: MediaPlayerProps) {
  const { t, i18n } = useAppTranslation()
  const container = useRef<HTMLDivElement>(null)
  const [nearby, setNearby] = useState(false)
  const [ratio, setRatio] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const isVideo = kind === 'video'
  const Element = kind

  useEffect(() => {
    if (!isVideo || !container.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearby(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [isVideo])

  return (
    <div ref={container} className="cairn-media font-sans text-[13px] leading-normal">
      {!isVideo && <div className="mb-2 font-medium">{title}</div>}
      <MediaController
        key={attempt}
        audio={!isVideo}
        lang={i18n.resolvedLanguage}
        autohide="2"
        className="cairn-player"
        aria-label={title}
        data-ready={String(!isVideo || ratio !== null)}
        data-failed={String(failed)}
        style={ratio ? ({ '--video-ratio': ratio } as CSSProperties) : undefined}
      >
        <Element
          slot="media"
          src={src}
          preload={isVideo && nearby ? 'metadata' : 'none'}
          playsInline
          onLoadedMetadata={(event) => {
            if (!isVideo) return
            const video = event.currentTarget as HTMLVideoElement
            if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight)
          }}
          onError={() => setFailed(true)}
        />
        {isVideo && (
          <>
            {!ratio && !failed && (
              <div slot="poster" className="cairn-player-placeholder" role="status">
                {t('library:loadingVideo')}
              </div>
            )}
            <MediaPlayButton slot="centered-chrome" className="cairn-player-start" />
            <MediaLoadingIndicator slot="centered-chrome" noAutohide />
          </>
        )}
        {isVideo && <MediaPlaybackRateMenu hidden anchor="auto" rates={[0.5, 0.75, 1, 1.25, 1.5, 2]} />}
        <div className="cairn-player-controls">
          <MediaTimeRange />
          <MediaControlBar>
            <MediaPlayButton />
            <span className="cairn-player-spacer" />
            <MediaTimeDisplay showDuration />
            <MediaMuteButton />
            {isVideo ? (
              <MediaPlaybackRateMenuButton>
                <svg
                  slot="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path
                    d="m9.5 3-.7 2.3-2 .9-2.2-.5-2.5 4.2 1.5 1.8v2.3L2.1 16l2.5 4.2 2.2-.5 2 .9.7 2.3h5l.7-2.3 2-.9 2.2.5 2.5-4.2-1.5-1.8v-2.3l1.5-1.8-2.5-4.2-2.2.5-2-.9L14.5 3z"
                    transform="translate(1 0) scale(.92)"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </MediaPlaybackRateMenuButton>
            ) : (
              <MediaPlaybackRateButton />
            )}
            {isVideo && <MediaPipButton />}
            {isVideo && <MediaFullscreenButton />}
          </MediaControlBar>
        </div>
        {failed && (
          <div slot={isVideo ? 'centered-chrome' : undefined} className="cairn-player-error" role="status">
            <p>{t('library:mediaUnavailable')}</p>
            <div className="mt-3 flex justify-center gap-5">
              <button
                className="underline underline-offset-4"
                onClick={() => {
                  setFailed(false)
                  setRatio(null)
                  setAttempt((n) => n + 1)
                }}
              >
                {t('library:retryMedia')}
              </button>
              <a className="underline underline-offset-4" href={src} download>
                {t('library:downloadMedia')}
              </a>
            </div>
          </div>
        )}
      </MediaController>
    </div>
  )
}
