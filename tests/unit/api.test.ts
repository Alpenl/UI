import { afterEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError, createApiClient } from '@/api/client'
afterEach(() => vi.unstubAllGlobals())
it('validates responses and forwards cancellation without including tokens', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"id":1}'))
  vi.stubGlobal('fetch', fetcher)
  const controller = new AbortController()
  expect(await createApiClient().get('/items/1', z.object({ id: z.number() }), controller.signal)).toEqual({ id: 1 })
  expect(fetcher).toHaveBeenCalledWith(
    '/api/items/1',
    expect.objectContaining({ signal: controller.signal, credentials: 'same-origin' }),
  )
})
it('rejects errors and malformed response contracts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private details', { status: 401 })))
  await expect(createApiClient().get('/items', z.array(z.string()))).rejects.toBeInstanceOf(ApiError)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  await expect(createApiClient().get('/items', z.array(z.string()))).rejects.toBeInstanceOf(z.ZodError)
  await expect(createApiClient().get('//external.invalid', z.unknown())).rejects.toThrow('relative API path')
})
