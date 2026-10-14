import type { z } from 'zod'
export const storageKey = (key: string) => `cairn-ui:demo:v1:${key}`
export function readStored<T>(storage: Pick<Storage, 'getItem'>, key: string, fallback: T, schema: z.ZodType<T>): T {
  try {
    const raw = storage.getItem(storageKey(key))
    return raw === null ? fallback : schema.parse(JSON.parse(raw))
  } catch {
    return fallback
  }
}
