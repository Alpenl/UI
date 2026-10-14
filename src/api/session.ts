import { z } from 'zod'

export const sessionSchema = z.object({
  code: z.literal('OK'),
  data: z.object({ authenticated: z.boolean() }),
})
export function csrfToken() {
  for (const name of ['__Host-cairn_csrf', 'cairn_csrf']) {
    const value = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.slice(name.length + 1)
    if (value) return value
  }
  return ''
}
export async function sessionRequest(method: 'GET' | 'POST' | 'DELETE', password?: string) {
  const response = await fetch('/api/v1/session', {
    method,
    credentials: 'same-origin',
    priority: 'high',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
    ...(password === undefined ? {} : { body: JSON.stringify({ password }) }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new Error(
      response.status === 429 ? 'rate_limited' : response.status === 401 ? 'invalid_password' : 'connection_failed',
    )
  return sessionSchema.parse(await response.json()).data.authenticated
}
