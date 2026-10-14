import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.env.STATIC_ROOT || fileURLToPath(new URL('../dist', import.meta.url)))
const upstream = new URL(process.env.CAIRN_BACKEND_URL || 'http://127.0.0.1:8088')
if (
  !['http:', 'https:'].includes(upstream.protocol) ||
  upstream.username ||
  upstream.password ||
  upstream.pathname !== '/'
)
  throw new Error('Expected a backend origin without credentials')
const workerOrigin = process.env.CAIRN_WORKER_URL ? new URL(process.env.CAIRN_WORKER_URL) : null
if (
  workerOrigin &&
  ((workerOrigin.protocol !== 'https:' &&
    !(workerOrigin.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(workerOrigin.hostname))) ||
    workerOrigin.username ||
    workerOrigin.password ||
    workerOrigin.pathname !== '/')
)
  throw new Error('Expected a secure Worker origin')
if (workerOrigin && !process.env.CAIRN_WORKER_TOKEN) throw new Error('Worker credential required')
const writePaths = [
  /^\/api\/custom-tags(?:\/[a-f0-9-]{36})?$/,
  /^\/api\/collections\/[a-f0-9-]{36}\/operations$/,
  /^\/api\/bookmarks\/[1-9][0-9]*\/tags$/,
  /^\/api\/tag-catalog\/operations$/,
]
const readPaths = [
  /^\/api\/workspace(?:\/(?:[1-9][0-9]*|collections\/[a-f0-9-]{36}))?$/,
  /^\/api\/(bookmarks|collections|tag-catalog|overview|custom-tags)$/,
  /^\/api\/bookmarks\/[1-9][0-9]*(\/tags)?$/,
  /^\/api\/collections\/[a-f0-9-]{36}(?:\/rules\/(?:preview|candidates))?$/,
]
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}
const reply = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
export const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  let url
  try {
    url = new URL(req.url, 'http://localhost')
  } catch {
    return reply(res, 400, { error: 'invalid_url' })
  }
  if (url.pathname === '/healthz')
    return reply(res, 200, { ok: true, service: 'cairn-ui', revision: process.env.APP_REVISION || 'development' })
  if (url.pathname.startsWith('/api/')) {
    let decodedPath
    try {
      decodedPath = decodeURIComponent(url.pathname)
    } catch {
      return reply(res, 400, { error: 'invalid_path' })
    }
    const image = /^\/api\/images\/enrichment\/[1-9]\d*\/[a-f0-9]{64}\.(?:jpg|png|webp|gif|avif)$/.test(decodedPath)
    const media = /^\/api\/media\/[a-f0-9]{32}$/.test(url.pathname)
    const asset = image || media
    const write = ['POST', 'PATCH', 'DELETE'].includes(req.method)
    if (['PATCH', 'DELETE'].includes(req.method) && !/^\/api\/custom-tags\/[a-f0-9-]{36}$/.test(url.pathname))
      return reply(res, 405, { error: 'unsupported_operation' })
    if (
      !(write
        ? writePaths.some((pattern) => pattern.test(url.pathname))
        : asset || readPaths.some((pattern) => pattern.test(url.pathname))) ||
      (!write && req.method !== 'GET' && !(media && req.method === 'HEAD'))
    )
      return reply(res, 405, { error: 'unsupported_operation' })
    if (write) {
      let origin
      try {
        origin = new URL(req.headers.origin)
      } catch {
        return reply(res, 403, { error: 'origin_required' })
      }
      if (origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol))
        return reply(res, 403, { error: 'origin_mismatch' })
      if (!req.headers['content-type']?.startsWith('application/json'))
        return reply(res, 415, { error: 'json_required' })
    }
    const headers = {
      accept: 'application/json',
      'user-agent': 'cairn-ui/1',
      'content-type': 'application/json',
      'x-cairn-tag-system': '1',
      'x-cairn-topic-granularity': '1',
      'x-cairn-collections': '2',
      ...(req.headers['accept-encoding'] ? { 'accept-encoding': req.headers['accept-encoding'] } : {}),
      ...(asset ? { accept: '*/*', 'x-cairn-image-privacy': '1' } : {}),
      ...(media && req.headers.range ? { range: req.headers.range } : {}),
      ...(image && req.headers['if-none-match'] ? { 'if-none-match': req.headers['if-none-match'] } : {}),
    }
    const direct =
      workerOrigin && (asset || /^\/api\/(collections|tag-catalog|custom-tags|workspace)(?:\/|$)/.test(url.pathname))
    const workerPath = asset
      ? url.pathname.replace('/api/', '/api/enrichment/')
      : url.pathname.startsWith('/api/workspace')
        ? url.pathname.replace('/api/workspace', '/api/enrichment/workspace')
        : url.pathname.startsWith('/api/collections')
          ? url.pathname.replace('/api/collections', '/api/enrichment/collections')
          : url.pathname.replace('/api/', '/api/v2/')
    const target = new URL((direct ? workerPath : url.pathname) + url.search, direct ? workerOrigin : upstream)
    if (direct) headers.authorization = `Bearer ${process.env.CAIRN_WORKER_TOKEN}`
    const proxy = (target.protocol === 'https:' ? httpsRequest : httpRequest)(
      target,
      { method: req.method, headers, timeout: 30000 },
      (response) => {
        res.writeHead(response.statusCode || 502, {
          'Content-Type': response.headers['content-type'] || 'application/json',
          'Cache-Control': 'no-store',
          ...(response.headers['content-encoding']
            ? { 'Content-Encoding': response.headers['content-encoding'], Vary: 'Accept-Encoding' }
            : {}),
          ...(response.headers['server-timing'] ? { 'Server-Timing': response.headers['server-timing'] } : {}),
          ...Object.fromEntries(
            (asset ? ['content-range', 'content-length', 'accept-ranges', 'etag', 'content-disposition'] : [])
              .filter((key) => response.headers[key] !== undefined)
              .map((key) => [key, response.headers[key]]),
          ),
        })
        response.pipe(res)
        response.on('error', () => res.destroy())
      },
    )
    proxy.on('timeout', () => proxy.destroy(new Error('upstream_timeout')))
    proxy.on('error', () => {
      if (!res.headersSent) reply(res, 502, { error: 'backend_unavailable' })
      else res.destroy()
    })
    req.on('aborted', () => proxy.destroy())
    res.on('close', () => {
      if (!res.writableFinished) proxy.destroy()
    })
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1024 * 1024) {
        proxy.destroy()
        if (!res.headersSent) reply(res, 413, { error: 'body_too_large' })
      }
    })
    req.pipe(proxy)
    return
  }
  if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'method_not_allowed' })
  try {
    let file = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (!file.startsWith(root + sep) && file !== root) return reply(res, 404, { error: 'not_found' })
    let metadata = await stat(file).catch(() => null)
    if (!metadata?.isFile()) {
      if (url.pathname.startsWith('/assets/') || extname(url.pathname)) return reply(res, 404, { error: 'not_found' })
      file = resolve(root, 'index.html')
      metadata = await stat(file)
    }
    const type = mime[extname(file)] || 'application/octet-stream'
    const encoding = ['br', 'gzip'].find((e) =>
      (req.headers['accept-encoding'] ?? '')
        .split(',')
        .some((x) => x.trim().split(';')[0] === e && !/q=0(?:\.0*)?$/.test(x.trim())),
    )
    if (encoding) {
      const compressed = file + (encoding === 'br' ? '.br' : '.gz')
      const compressedMeta = await stat(compressed).catch(() => null)
      if (compressedMeta?.isFile()) {
        file = compressed
        metadata = compressedMeta
        res.setHeader('Content-Encoding', encoding)
      }
    }
    res.setHeader('Vary', 'Accept-Encoding')
    const etag = `"${metadata.size.toString(16)}-${Math.floor(metadata.mtimeMs).toString(16)}"`
    res.setHeader('ETag', etag)
    res.setHeader(
      'Cache-Control',
      url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    )
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304)
      return res.end()
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': metadata.size,
      'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    if (req.method === 'HEAD') return res.end()
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res)
  } catch {
    reply(res, 404, { error: 'not_found' })
  }
})
server.requestTimeout = 35000
server.headersTimeout = 15000
server.listen(Number(process.env.PORT || 8080), process.env.HOST || '0.0.0.0')
process.on('SIGTERM', () => {
  server.close()
  setTimeout(() => process.exit(0), 10000).unref()
})
