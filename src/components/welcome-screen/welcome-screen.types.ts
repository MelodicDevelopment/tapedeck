import type { Mixtape, SavedSource } from '../../lib/library'

export type LibraryEntry =
  | { type: 'source'; key: string; data: SavedSource }
  | { type: 'mixtape'; key: string; data: Mixtape }

export type LibraryKind = 'all' | 'channel' | 'playlist' | 'video' | 'mixtape'

export const LIBRARY_KINDS: { id: LibraryKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'channel', label: 'Channels' },
  { id: 'playlist', label: 'Playlists' },
  { id: 'video', label: 'Videos' },
  { id: 'mixtape', label: 'Mixtapes' },
]

/** Buckets a library entry for the kind filter and the card's kind tag. */
export function entryKind(entry: LibraryEntry): Exclude<LibraryKind, 'all'> {
  if (entry.type === 'mixtape') return 'mixtape'
  const kind = entry.data.kind.toLowerCase()
  if (kind.includes('playlist')) return 'playlist'
  if (kind.includes('video')) return 'video'
  return 'channel'
}

export const KIND_LABELS: Record<Exclude<LibraryKind, 'all'>, string> = {
  channel: 'Channel',
  playlist: 'Playlist',
  video: 'Video',
  mixtape: 'Mixtape',
}
