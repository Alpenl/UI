import manifest from './media.json'
import { DESIGN } from '@/api/production-mode'

/** Only committed local media is served in design mode; no production credentials or URLs. */
export function mediaPath(path: string) {
  if (!DESIGN) return path
  const id = path.match(/^\/api\/(?:v1\/)?media\/([a-f0-9]{32})$/)?.[1]
  const entry = id ? (manifest as Record<string, { src: string }>)[id] : undefined
  if (!entry) throw new Error('design_media_missing')
  return entry.src
}
