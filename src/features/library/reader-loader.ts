// Share the lazy import with intent preloading; no reader/media code on the cold home page.
export const loadReader = () => import('./components/reader').then((module) => ({ default: module.Reader }))
