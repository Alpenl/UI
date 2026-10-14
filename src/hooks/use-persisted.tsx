import { readStored, storageKey } from '@/lib/storage'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { z } from 'zod'
/** Local demo persistence; production data belongs to the repository/API layer. */
export function usePersisted<T>(
  key: string,
  initial: T,
  schema: z.ZodType<T>,
  enabled = true,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (!enabled) return initial
    try {
      return readStored(localStorage, key, initial, schema)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    if (!enabled) return
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value))
    } catch {
      /* Memory state remains usable. */
    }
  }, [key, value, enabled])
  return [value, setValue]
}
