// This repository defaults to an offline copy of the current production UI.
export const DESIGN = !['live', 'demo'].includes(import.meta.env.VITE_DATA_MODE ?? '')
export const DESIGN_DATE = '2026-10-14'
export const LIVE = DESIGN || import.meta.env.VITE_DATA_MODE === 'live'
export const GO_BACKEND = DESIGN || (LIVE && import.meta.env.VITE_API_BACKEND === 'go')
export const apiPath = (path: string) =>
  GO_BACKEND && path.startsWith('/api/') && !path.startsWith('/api/v1/') ? path.replace('/api/', '/api/v1/') : path
