export function validateYouTubeSource(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Paste a YouTube video, channel, or playlist URL first.'

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const videoId = /^[A-Za-z0-9_-]{11}$/
    if (host === 'youtu.be') {
      if (!videoId.test(parsed.pathname.split('/').filter(Boolean)[0] ?? '')) throw new Error('Invalid source')
      return ''
    }
    const isYouTube = host === 'youtube.com' || host === 'music.youtube.com'
    const channelPath = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/i.test(parsed.pathname)
    const videoPath = /^\/(?:shorts|embed|live|v)\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(parsed.pathname)
    const playlistUrl = parsed.searchParams.has('list')
    const videoUrl = videoId.test(parsed.searchParams.get('v') ?? '')

    if (!isYouTube || (!channelPath && !playlistUrl && !videoUrl && !videoPath)) throw new Error('Invalid source')
    return ''
  } catch {
    return "That doesn't look like a YouTube video, channel, or playlist link. Check the URL and try again."
  }
}

/**
 * The 11-character video id from any YouTube video link (watch, youtu.be,
 * shorts, embed, live), or null when the URL isn't a single video. A watch
 * URL that also carries a `list` param still counts as its video — callers
 * that want just the video should re-resolve via `videoWatchUrl`.
 */
export function extractYouTubeVideoId(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const videoId = /^[A-Za-z0-9_-]{11}$/
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
      return videoId.test(id) ? id : null
    }
    if (host !== 'youtube.com' && host !== 'music.youtube.com') return null
    const fromQuery = parsed.searchParams.get('v') ?? ''
    if (videoId.test(fromQuery)) return fromQuery
    const fromPath = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/.exec(parsed.pathname)
    return fromPath ? fromPath[1] : null
  } catch {
    return null
  }
}

/** Canonical single-video URL, so resolvers don't prefer a `list` param on it. */
export function videoWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Whether free text in a "search or paste a link" field should be treated as
 * a URL (loaded, and validated as one) rather than a search query. Anything
 * with a scheme, a YouTube host, or a bare domain-shaped first token counts.
 */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/(^|\.)(youtube\.com|youtu\.be)(\/|$)/i.test(trimmed)) return true
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(trimmed)
}
