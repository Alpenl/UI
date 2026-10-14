import { createServer } from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
let process: ChildProcess, root: string
const seen: string[] = []
const authSeen: Array<{ path: string; auth?: string; protocol?: string }> = []
const upstream = createServer((req, res) => {
  seen.push(req.url!)
  authSeen.push({
    path: req.url!,
    auth: req.headers.authorization,
    protocol: String(req.headers['x-cairn-collections']),
  })
  if (req.url?.startsWith('/api/enrichment/images/')) {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('ETag', '"image"')
    res.end(req.headers['x-cairn-image-privacy'] === '1' ? 'private image' : 'missing privacy check')
    return
  }
  if (req.url?.startsWith('/api/enrichment/media/')) {
    res.writeHead(req.headers.range === 'bytes=2-5' ? 206 : 200, {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Range': 'bytes 2-5/10',
      'Content-Length': '4',
      ETag: '"media"',
    })
    res.end(req.method === 'HEAD' ? undefined : '2345')
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.end('{"ok":true}')
})
const origin = 'http://127.0.0.1:5199'
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'cairn-ui-server-'))
  await writeFile(join(root, 'index.html'), '<html>UI</html>')
  await new Promise<void>((done) => upstream.listen(0, '127.0.0.1', done))
  const address = upstream.address()
  if (!address || typeof address === 'string') throw new Error('address')
  process = spawn('node', ['deploy/server.mjs'], {
    env: {
      ...globalThis.process.env,
      HOST: '127.0.0.1',
      PORT: '5199',
      STATIC_ROOT: root,
      CAIRN_WORKER_URL: `http://127.0.0.1:${address.port}`,
      CAIRN_WORKER_TOKEN: 'unit-test-only',
      CAIRN_BACKEND_URL: `http://127.0.0.1:${address.port}`,
    },
    stdio: 'ignore',
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/healthz')).ok) return
    } catch {
      /* Starting */
    }
    await new Promise((done) => setTimeout(done, 30))
  }
  throw new Error('Server did not start')
})
afterAll(async () => {
  process?.kill('SIGTERM')
  upstream.closeAllConnections()
  await new Promise<void>((done) => upstream.close(() => done()))
  await rm(root, { recursive: true, force: true })
})
it('serves SPA routes and forwards only the supported API paths', async () => {
  expect(await (await fetch(origin + '/reading')).text()).toContain('<html>UI</html>')
  const response = await fetch(origin + '/api/bookmarks?limit=60')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(seen).toContain('/api/bookmarks?limit=60')
  expect((await fetch(origin + '/assets/missing.js')).status).toBe(404)
  expect((await fetch(origin + '/api/service/recover', { method: 'POST' })).status).toBe(405)
})
it('rejects cross-origin writes and accepts same-origin JSON with no embedded credentials', async () => {
  const path = origin + '/api/bookmarks/1/tags'
  expect(
    (
      await fetch(path, {
        method: 'POST',
        headers: { Origin: 'https://other.invalid', 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(403)
  expect(
    (await fetch(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }))
      .status,
  ).toBe(200)
})

it('negotiates collection v2 through the internal Worker route and keeps credentials server-side', async () => {
  expect((await fetch(origin + '/api/collections')).status).toBe(200)
  expect(authSeen.at(-1)).toEqual({ path: '/api/enrichment/collections', auth: 'Bearer unit-test-only', protocol: '2' })
  await fetch(origin + '/api/bookmarks?limit=1')
  expect(authSeen.at(-1)?.auth).toBeUndefined()
  const path = '/api/custom-tags/11111111-1111-4111-8111-111111111111'
  for (const method of ['PATCH', 'DELETE']) {
    expect(
      (
        await fetch(origin + path, {
          method,
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(200)
    expect(authSeen.at(-1)?.path).toBe(path.replace('/api/', '/api/v2/'))
    expect(
      (
        await fetch(origin + path, {
          method,
          headers: { Origin: 'https://other.invalid', 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(403)
  }
  expect((await fetch(origin + '/api/collections', { method: 'DELETE', headers: { Origin: origin } })).status).toBe(405)
})
it('routes bounded workspace reads directly and validates static resources with ETags', async () => {
  await fetch(origin + '/api/workspace?q=find&cursor=40')
  expect(authSeen.at(-1)).toEqual({
    path: '/api/enrichment/workspace?q=find&cursor=40',
    auth: 'Bearer unit-test-only',
    protocol: '2',
  })
  const first = await fetch(origin + '/')
  const etag = first.headers.get('etag')
  expect(etag).toBeTruthy()
  const unchanged = await fetch(origin + '/', { headers: { 'If-None-Match': etag! } })
  expect(unchanged.status).toBe(304)
  expect(await unchanged.text()).toBe('')
})

it('streams archived media with ranges and private image validation, rejecting arbitrary paths and writes', async () => {
  const image = '/api/images/' + encodeURIComponent('enrichment/1/' + 'a'.repeat(64) + '.png')
  const response = await fetch(origin + image)
  expect(await response.text()).toBe('private image')
  expect(response.headers.get('content-type')).toBe('image/png')
  expect(authSeen.at(-1)?.auth).toBe('Bearer unit-test-only')
  const media = '/api/media/' + 'b'.repeat(32)
  const range = await fetch(origin + media, { headers: { Range: 'bytes=2-5' } })
  expect(range.status).toBe(206)
  expect(range.headers.get('content-range')).toBe('bytes 2-5/10')
  expect(range.headers.get('accept-ranges')).toBe('bytes')
  expect(await range.text()).toBe('2345')
  const head = await fetch(origin + media, { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(head.headers.get('content-length')).toBe('4')
  expect(await head.text()).toBe('')
  for (const path of [image, media, '/api/images/https%3A%2F%2Fother.invalid', '/api/media/uploads/' + 'b'.repeat(32)])
    expect((await fetch(origin + path, { method: 'POST', headers: { Origin: origin } })).status).toBe(405)
  expect((await fetch(origin + '/api/images/https%3A%2F%2Fother.invalid')).status).toBe(405)
})
