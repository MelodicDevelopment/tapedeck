const API_ROOT = 'https://www.googleapis.com/youtube/v3'
const DEFAULT_MAX_TRACKS = 150

export class YouTubeResolverError extends Error {
  constructor(message, status = 500, code = 'YOUTUBE_ERROR') {
    super(message)
    this.name = 'YouTubeResolverError'
    this.status = status
    this.code = code
  }
}

export function parseYouTubeSource(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed || trimmed.length > 2048) {
    throw new YouTubeResolverError('Provide a valid YouTube channel or playlist URL.', 400, 'INVALID_URL')
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'youtube.com' && host !== 'music.youtube.com') throw new Error('Wrong host')

    const playlistId = url.searchParams.get('list')
    if (playlistId) return { type: 'playlist', id: playlistId, canonicalUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}` }

    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    if (parts[0]?.startsWith('@') && parts[0].length > 1) {
      return { type: 'channel', filter: 'forHandle', id: parts[0], canonicalUrl: `https://www.youtube.com/${encodeURIComponent(parts[0])}` }
    }
    if (parts[0] === 'channel' && parts[1]) {
      return { type: 'channel', filter: 'id', id: parts[1], canonicalUrl: `https://www.youtube.com/channel/${encodeURIComponent(parts[1])}` }
    }
    if (parts[0] === 'user' && parts[1]) {
      return { type: 'channel', filter: 'forUsername', id: parts[1], canonicalUrl: `https://www.youtube.com/user/${encodeURIComponent(parts[1])}` }
    }
    if (parts[0] === 'c' && parts[1]) {
      return { type: 'custom', id: parts[1], canonicalUrl: `https://www.youtube.com/c/${encodeURIComponent(parts[1])}` }
    }
    throw new Error('Unsupported path')
  } catch (error) {
    if (error instanceof YouTubeResolverError) throw error
    throw new YouTubeResolverError(
      "That doesn't look like a YouTube channel or playlist link. Check the URL and try again.",
      400,
      'INVALID_URL',
    )
  }
}

export function parseIsoDuration(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value ?? '')
  if (!match) return 0
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0)
}

function bestThumbnail(thumbnails) {
  return thumbnails?.maxres?.url ?? thumbnails?.standard?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? ''
}

async function youtubeGet(resource, params, apiKey, fetchImpl) {
  const url = new URL(`${API_ROOT}/${resource}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  url.searchParams.set('key', apiKey)

  let response
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) })
  } catch {
    throw new YouTubeResolverError('YouTube could not be reached. Try again in a moment.', 502, 'YOUTUBE_UNREACHABLE')
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new YouTubeResolverError('The YouTube API quota is temporarily exhausted. Try again later.', 429, 'QUOTA_EXCEEDED')
    }
    if (response.status === 400 || response.status === 404) {
      throw new YouTubeResolverError('YouTube could not find that channel or playlist.', 404, 'SOURCE_NOT_FOUND')
    }
    throw new YouTubeResolverError('YouTube rejected the request. Check the server API-key configuration.', 502, 'YOUTUBE_REJECTED')
  }
  return body
}

async function resolveChannel(source, apiKey, fetchImpl) {
  let filter = source.filter
  let identifier = source.id

  if (source.type === 'custom') {
    const search = await youtubeGet('search', { part: 'snippet', q: source.id, type: 'channel', maxResults: 1 }, apiKey, fetchImpl)
    identifier = search.items?.[0]?.snippet?.channelId
    filter = 'id'
  }

  if (!identifier || !filter) throw new YouTubeResolverError('YouTube could not find that channel.', 404, 'SOURCE_NOT_FOUND')
  const response = await youtubeGet('channels', { part: 'snippet,contentDetails', [filter]: identifier, maxResults: 1 }, apiKey, fetchImpl)
  const channel = response.items?.[0]
  if (!channel) throw new YouTubeResolverError('YouTube could not find that channel.', 404, 'SOURCE_NOT_FOUND')

  return {
    playlistId: channel.contentDetails?.relatedPlaylists?.uploads,
    name: channel.snippet?.title ?? 'YouTube channel',
    description: channel.snippet?.description ?? '',
    thumbnail: bestThumbnail(channel.snippet?.thumbnails),
    kind: 'YouTube channel',
  }
}

async function resolvePlaylist(source, apiKey, fetchImpl) {
  const response = await youtubeGet('playlists', { part: 'snippet,contentDetails', id: source.id, maxResults: 1 }, apiKey, fetchImpl)
  const playlist = response.items?.[0]
  if (!playlist) throw new YouTubeResolverError('YouTube could not find that playlist, or it is private.', 404, 'SOURCE_NOT_FOUND')

  return {
    playlistId: playlist.id,
    name: playlist.snippet?.title ?? 'YouTube playlist',
    description: playlist.snippet?.description ?? '',
    thumbnail: bestThumbnail(playlist.snippet?.thumbnails),
    kind: 'YouTube playlist',
  }
}

async function loadPlaylistItems(playlistId, maxTracks, apiKey, fetchImpl) {
  const items = []
  let pageToken
  do {
    const response = await youtubeGet(
      'playlistItems',
      { part: 'snippet,contentDetails,status', playlistId, maxResults: Math.min(50, maxTracks - items.length), pageToken },
      apiKey,
      fetchImpl,
    )
    items.push(...(response.items ?? []))
    pageToken = response.nextPageToken
  } while (pageToken && items.length < maxTracks)
  return items.slice(0, maxTracks)
}

async function loadVideoDetails(videoIds, apiKey, fetchImpl) {
  const details = new Map()
  for (let index = 0; index < videoIds.length; index += 50) {
    const ids = videoIds.slice(index, index + 50)
    const response = await youtubeGet('videos', { part: 'contentDetails,status', id: ids.join(','), maxResults: 50 }, apiKey, fetchImpl)
    for (const item of response.items ?? []) details.set(item.id, item)
  }
  return details
}

export async function resolveYouTubeUrl(value, options = {}) {
  const source = parseYouTubeSource(value)
  const apiKey = options.apiKey
  if (!apiKey) {
    throw new YouTubeResolverError(
      'The YouTube Data API is not configured yet. Add YOUTUBE_API_KEY to the server environment, or open the demo playlist.',
      503,
      'API_NOT_CONFIGURED',
    )
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const maxTracks = Math.max(1, Math.min(Number(options.maxTracks) || DEFAULT_MAX_TRACKS, 200))
  const metadata = source.type === 'playlist'
    ? await resolvePlaylist(source, apiKey, fetchImpl)
    : await resolveChannel(source, apiKey, fetchImpl)

  if (!metadata.playlistId) throw new YouTubeResolverError('This channel does not expose an uploads playlist.', 404, 'SOURCE_NOT_FOUND')
  const playlistItems = await loadPlaylistItems(metadata.playlistId, maxTracks, apiKey, fetchImpl)
  const videoIds = playlistItems.map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId).filter(Boolean)
  const videoDetails = await loadVideoDetails(videoIds, apiKey, fetchImpl)

  const tracks = playlistItems.map((item, index) => {
    const id = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? `unavailable-${index}`
    const detail = videoDetails.get(id)
    const unavailable = !detail || detail.status?.embeddable === false || detail.status?.privacyStatus !== 'public'
    return {
      id,
      title: item.snippet?.title ?? 'Unavailable video',
      artist: unavailable ? 'Unavailable on YouTube' : (item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? metadata.name),
      duration: parseIsoDuration(detail?.contentDetails?.duration),
      unavailable,
    }
  })

  if (!tracks.length) throw new YouTubeResolverError('That source does not contain any public videos.', 404, 'EMPTY_SOURCE')
  return {
    name: metadata.name,
    kind: metadata.kind,
    description: metadata.description,
    thumbnail: metadata.thumbnail,
    sourceUrl: source.canonicalUrl,
    tracks,
  }
}
