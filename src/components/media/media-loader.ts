// Share the import between data-driven preloading and React.lazy. No media bytes are fetched here.
export const loadMediaPlayer = () => import('./media-player').then((module) => ({ default: module.MediaPlayer }))
