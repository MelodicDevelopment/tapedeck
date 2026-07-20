import 'dotenv/config'
import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveYouTubeUrl, YouTubeResolverError } from './youtube.js'

const app = express()
const port = Number(process.env.PORT) || 8787
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const cache = new Map()
const attempts = new Map()
const cacheTtl = Math.max(60000, Number(process.env.YOUTUBE_CACHE_TTL_MS) || 600000)
const maxTracks = Math.max(1, Math.min(Number(process.env.YOUTUBE_MAX_TRACKS) || 150, 200))
const allowedOrigins = new Set([
  'http://127.0.0.1:14321',
  'http://localhost:14321',
  ...(process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
])

app.disable('x-powered-by')
app.use(express.json({ limit: '4kb' }))

app.use('/api', (request, response, next) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('access-control-allow-origin', origin)
    response.setHeader('access-control-allow-headers', 'content-type')
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
    response.setHeader('vary', 'Origin')
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

app.use('/api', (request, response, next) => {
  const now = Date.now()
  const key = request.ip ?? 'unknown'
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < 10 * 60 * 1000)
  if (recent.length >= 60) return response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } })
  recent.push(now)
  attempts.set(key, recent)
  next()
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY) })
})

app.post('/api/youtube/resolve', async (request, response) => {
  try {
    const url = String(request.body?.url ?? '')
    const cached = cache.get(url.trim())
    if (cached && Date.now() - cached.createdAt < cacheTtl) return response.json(cached.value)

    const value = await resolveYouTubeUrl(url, {
      apiKey: process.env.YOUTUBE_API_KEY,
      maxTracks,
    })
    cache.set(url.trim(), { createdAt: Date.now(), value })
    if (cache.size > 100) cache.delete(cache.keys().next().value)
    response.json(value)
  } catch (error) {
    const known = error instanceof YouTubeResolverError
    response.status(known ? error.status : 500).json({
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Tapedeck could not load that source.',
      },
    })
  }
})

if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get('*path', (_request, response) => response.sendFile(join(dist, 'index.html')))
}

app.listen(port, '127.0.0.1', () => {
  console.log(`Tapedeck server listening on http://127.0.0.1:${port}`)
})
