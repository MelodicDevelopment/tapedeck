import type { Playlist, Track } from '../data/mockPlaylist'
import { extractYouTubeVideoId } from './validation'

export type YouTubeLinkAction =
  | { kind: 'play-inline'; videoId: string }
  | { kind: 'open-external'; url: string }

/** `feature` values YouTube's embedded player attaches to links that mean
 *  "take me to this video on youtube.com": the logo, the title overlay, and
 *  the "Watch on YouTube" prompt shown when embedding is disabled. */
const WATCH_ON_YOUTUBE_FEATURES = new Set(['emb_logo', 'emb_title', 'emb_imp_woyt'])

/**
 * Decides what a YouTube video link that tried to open a new window should
 * do. A related video (end screens, "More videos" overlay) plays inline; the
 * current video — from the player's own "Watch on YouTube" affordances or
 * Tapedeck's title link — opens in the user's browser.
 */
export function classifyYouTubeLink(url: string, onScreenVideoId: string | undefined): YouTubeLinkAction {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return { kind: 'open-external', url }
  let feature = ''
  try {
    feature = new URL(url).searchParams.get('feature') ?? ''
  } catch {
    // Not a parseable absolute URL; fall through to the id comparison.
  }
  if (videoId === onScreenVideoId || WATCH_ON_YOUTUBE_FEATURES.has(feature)) {
    return { kind: 'open-external', url }
  }
  return { kind: 'play-inline', videoId }
}

export function videoPageUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Where the creator's name should link. The uploader's channel when known;
 * otherwise the source itself when that is a channel page; otherwise a
 * YouTube search for the name, so older saved tracks still get somewhere
 * useful. Null for unavailable tracks (no real creator to show).
 */
export function creatorPageUrl(track: Track, playlist: Playlist): string | null {
  if (track.unavailable) return null
  if (track.channelId) return `https://www.youtube.com/channel/${track.channelId}`
  if (/channel/i.test(playlist.kind) && playlist.sourceUrl.startsWith('http')) return playlist.sourceUrl
  if (!track.artist.trim()) return null
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(track.artist.trim())}`
}
