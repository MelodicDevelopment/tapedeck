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
