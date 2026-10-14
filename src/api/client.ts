import type { z } from 'zod'
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly requestId: string | null,
  ) {
    super(`Request failed (${status})`)
    this.name = 'ApiError'
  }
}
/** A transport boundary for future backend integration. No credentials are bundled. */
export function createApiClient(baseUrl = '/api') {
  return {
    async get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected a relative API path')
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        signal,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new ApiError(response.status, response.headers.get('x-request-id'))
      return schema.parse(await response.json())
    },
  }
}
