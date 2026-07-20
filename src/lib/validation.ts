export function validateYouTubeSource(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Paste a YouTube channel or playlist URL first.'

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const isYouTube = host === 'youtube.com' || host === 'music.youtube.com'
    const channelPath = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/i.test(parsed.pathname)
    const playlistUrl = parsed.searchParams.has('list')

    if (!isYouTube || (!channelPath && !playlistUrl)) throw new Error('Invalid source')
    return ''
  } catch {
    return "That doesn't look like a YouTube channel or playlist link. Check the URL and try again."
  }
}
