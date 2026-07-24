import { Playlist, thumbnailUrl, Track } from '../data/mockPlaylist'
import type { RepeatMode } from './playback'

export type SavedSource = {
  url: string
  name: string
  kind: string
  thumbnail: string
  savedAt: string
  /** Cached so the library/"Continue listening" can open instantly, then revalidate in the background. */
  tracks: Track[]
  lastTrackId?: string
  lastPositionSecs?: number
  lastPlayedAt?: string
}

export type Mixtape = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  tracks: Track[]
  lastTrackId?: string
  lastPositionSecs?: number
  lastPlayedAt?: string
}

export type PlaybackSettings = {
  shuffle: boolean
  repeatMode: RepeatMode
  volume: number
}

/** A deletion record so sync merges know "explicitly removed" apart from "never seen". */
export type Tombstone = { id: string; deletedAt: string }

export type Library = {
  version: 1
  sources: SavedSource[]
  mixtapes: Mixtape[]
  playbackSettings: PlaybackSettings
  /** Tombstones keyed by SavedSource.url. */
  deletedSourceUrls: Tombstone[]
  /** Tombstones keyed by Mixtape.id. */
  deletedMixtapeIds: Tombstone[]
}

const MAX_SOURCES = 30
const REPEAT_MODES: RepeatMode[] = ['off', 'all', 'one']
const DEFAULT_VOLUME = 70

export function emptyLibrary(): Library {
  return {
    version: 1,
    sources: [],
    mixtapes: [],
    playbackSettings: { shuffle: false, repeatMode: 'off', volume: DEFAULT_VOLUME },
    deletedSourceUrls: [],
    deletedMixtapeIds: [],
  }
}

/** Keeps the freshest tombstone per id when the same deletion is recorded twice. */
function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const byId = new Map(a.map((tombstone) => [tombstone.id, tombstone]))
  for (const tombstone of b) {
    const existing = byId.get(tombstone.id)
    if (!existing || tombstone.deletedAt > existing.deletedAt) byId.set(tombstone.id, tombstone)
  }
  return [...byId.values()]
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Defensive parse of whatever was persisted; anything malformed is dropped. */
export function normalizeLibrary(value: unknown): Library {
  const library = emptyLibrary()
  if (typeof value !== 'object' || value === null) return library
  const candidate = value as {
    sources?: unknown
    mixtapes?: unknown
    playbackSettings?: unknown
    deletedSourceUrls?: unknown
    deletedMixtapeIds?: unknown
  }

  const isTrack = (track: unknown): track is Track => {
    const t = track as Track
    return Boolean(t && typeof t.id === 'string' && typeof t.title === 'string')
  }

  const isTombstone = (tombstone: unknown): tombstone is Tombstone => {
    const t = tombstone as Tombstone
    return Boolean(t && typeof t.id === 'string' && t.id && typeof t.deletedAt === 'string')
  }

  if (Array.isArray(candidate.sources)) {
    library.sources = candidate.sources
      .filter((source): source is SavedSource => {
        const s = source as SavedSource
        return Boolean(s && typeof s.url === 'string' && s.url && typeof s.name === 'string')
      })
      .map((source) => ({
        url: source.url,
        name: source.name,
        kind: typeof source.kind === 'string' ? source.kind : 'YouTube source',
        thumbnail: typeof source.thumbnail === 'string' ? source.thumbnail : '',
        savedAt: typeof source.savedAt === 'string' ? source.savedAt : new Date().toISOString(),
        tracks: Array.isArray(source.tracks) ? source.tracks.filter(isTrack) : [],
        lastTrackId: typeof source.lastTrackId === 'string' ? source.lastTrackId : undefined,
        lastPositionSecs:
          typeof source.lastPositionSecs === 'number' && Number.isFinite(source.lastPositionSecs)
            ? source.lastPositionSecs
            : undefined,
        lastPlayedAt: typeof source.lastPlayedAt === 'string' ? source.lastPlayedAt : undefined,
      }))
      .slice(0, MAX_SOURCES)
  }

  if (Array.isArray(candidate.mixtapes)) {
    library.mixtapes = candidate.mixtapes
      .filter((mixtape): mixtape is Mixtape => {
        const m = mixtape as Mixtape
        return Boolean(m && typeof m.id === 'string' && m.id && typeof m.name === 'string' && Array.isArray(m.tracks))
      })
      .map((mixtape) => ({
        id: mixtape.id,
        name: mixtape.name,
        createdAt: typeof mixtape.createdAt === 'string' ? mixtape.createdAt : new Date().toISOString(),
        updatedAt: typeof mixtape.updatedAt === 'string' ? mixtape.updatedAt : mixtape.createdAt ?? new Date().toISOString(),
        tracks: mixtape.tracks.filter(isTrack),
        lastTrackId: typeof mixtape.lastTrackId === 'string' ? mixtape.lastTrackId : undefined,
        lastPositionSecs:
          typeof mixtape.lastPositionSecs === 'number' && Number.isFinite(mixtape.lastPositionSecs)
            ? mixtape.lastPositionSecs
            : undefined,
        lastPlayedAt: typeof mixtape.lastPlayedAt === 'string' ? mixtape.lastPlayedAt : undefined,
      }))
  }

  if (Array.isArray(candidate.deletedSourceUrls)) {
    library.deletedSourceUrls = candidate.deletedSourceUrls.filter(isTombstone)
  }
  if (Array.isArray(candidate.deletedMixtapeIds)) {
    library.deletedMixtapeIds = candidate.deletedMixtapeIds.filter(isTombstone)
  }

  const settings = candidate.playbackSettings as { shuffle?: unknown; repeatMode?: unknown; volume?: unknown } | undefined
  if (settings && typeof settings === 'object') {
    library.playbackSettings = {
      shuffle: typeof settings.shuffle === 'boolean' ? settings.shuffle : false,
      repeatMode: REPEAT_MODES.includes(settings.repeatMode as RepeatMode)
        ? (settings.repeatMode as RepeatMode)
        : 'off',
      volume:
        typeof settings.volume === 'number' && Number.isFinite(settings.volume)
          ? Math.min(Math.max(Math.round(settings.volume), 0), 100)
          : DEFAULT_VOLUME,
    }
  }

  return library
}

/**
 * Save a successfully loaded source, most recent first, deduplicated by URL.
 * Preserves any existing resume state (last track/position/played-at) for a
 * source that's being refreshed rather than saved for the first time.
 */
export function upsertSource(
  library: Library,
  source: Omit<SavedSource, 'savedAt' | 'lastTrackId' | 'lastPositionSecs' | 'lastPlayedAt'>,
): Library {
  const existing = library.sources.find((candidate) => candidate.url === source.url)
  const entry: SavedSource = {
    ...source,
    savedAt: new Date().toISOString(),
    lastTrackId: existing?.lastTrackId,
    lastPositionSecs: existing?.lastPositionSecs,
    lastPlayedAt: existing?.lastPlayedAt,
  }
  const others = library.sources.filter((entry) => entry.url !== source.url)
  return { ...library, sources: [entry, ...others].slice(0, MAX_SOURCES) }
}

export function removeSource(library: Library, url: string): Library {
  return {
    ...library,
    sources: library.sources.filter((source) => source.url !== url),
    deletedSourceUrls: mergeTombstones(library.deletedSourceUrls, [
      { id: url, deletedAt: new Date().toISOString() },
    ]),
  }
}

export function createMixtape(library: Library, name: string, firstTrack: Track): Library {
  const now = new Date().toISOString()
  const mixtape: Mixtape = {
    id: generateId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    tracks: [firstTrack],
  }
  return { ...library, mixtapes: [mixtape, ...library.mixtapes] }
}

export function mixtapeHasTrack(mixtape: Mixtape, trackId: string): boolean {
  return mixtape.tracks.some((track) => track.id === trackId)
}

/** Add the track if the mixtape doesn't have it yet, remove it otherwise. */
export function toggleMixtapeTrack(library: Library, mixtapeId: string, track: Track): Library {
  return {
    ...library,
    mixtapes: library.mixtapes.map((mixtape) => {
      if (mixtape.id !== mixtapeId) return mixtape
      const updatedAt = new Date().toISOString()
      return mixtapeHasTrack(mixtape, track.id)
        ? { ...mixtape, tracks: mixtape.tracks.filter((existing) => existing.id !== track.id), updatedAt }
        : { ...mixtape, tracks: [...mixtape.tracks, track], updatedAt }
    }),
  }
}

export function deleteMixtape(library: Library, mixtapeId: string): Library {
  return {
    ...library,
    mixtapes: library.mixtapes.filter((mixtape) => mixtape.id !== mixtapeId),
    deletedMixtapeIds: mergeTombstones(library.deletedMixtapeIds, [
      { id: mixtapeId, deletedAt: new Date().toISOString() },
    ]),
  }
}

/** Move a track within a mixtape from one position to another. */
export function reorderMixtapeTrack(
  library: Library,
  mixtapeId: string,
  fromIndex: number,
  toIndex: number,
): Library {
  return {
    ...library,
    mixtapes: library.mixtapes.map((mixtape) => {
      if (mixtape.id !== mixtapeId) return mixtape
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= mixtape.tracks.length ||
        toIndex >= mixtape.tracks.length
      ) {
        return mixtape
      }
      const tracks = [...mixtape.tracks]
      const [moved] = tracks.splice(fromIndex, 1)
      tracks.splice(toIndex, 0, moved)
      return { ...mixtape, tracks, updatedAt: new Date().toISOString() }
    }),
  }
}

export type PlaybackTarget = { type: 'source'; url: string } | { type: 'mixtape'; id: string }

/** Mark a source/mixtape as just-opened, for "Continue listening" and last-played sorting. */
export function touchLastPlayed(library: Library, target: PlaybackTarget): Library {
  const lastPlayedAt = new Date().toISOString()
  if (target.type === 'source') {
    return {
      ...library,
      sources: library.sources.map((source) =>
        source.url === target.url ? { ...source, lastPlayedAt } : source,
      ),
    }
  }
  return {
    ...library,
    mixtapes: library.mixtapes.map((mixtape) =>
      mixtape.id === target.id ? { ...mixtape, lastPlayedAt } : mixtape,
    ),
  }
}

/** Record where playback left off, so reopening the source/mixtape resumes from here. */
export function recordPlaybackProgress(
  library: Library,
  target: PlaybackTarget,
  trackId: string,
  positionSecs: number,
): Library {
  if (target.type === 'source') {
    return {
      ...library,
      sources: library.sources.map((source) =>
        source.url === target.url
          ? { ...source, lastTrackId: trackId, lastPositionSecs: positionSecs }
          : source,
      ),
    }
  }
  return {
    ...library,
    mixtapes: library.mixtapes.map((mixtape) =>
      mixtape.id === target.id
        ? { ...mixtape, lastTrackId: trackId, lastPositionSecs: positionSecs }
        : mixtape,
    ),
  }
}

/** Latest of the given ISO timestamps (undefined entries ignored). */
function freshestTimestamp(...timestamps: (string | undefined)[]): string {
  return timestamps.filter((value): value is string => Boolean(value)).sort().at(-1) ?? ''
}

/**
 * Combine an imported/remote library into the current one: whole-object
 * last-write-wins per entry, keyed by URL for sources and id for mixtapes.
 * "Last write" considers both the metadata timestamp (savedAt/updatedAt) and
 * lastPlayedAt, so resuming playback on one device makes its copy of that
 * entry win the next sync even without a metadata edit. Run
 * `normalizeLibrary` on the incoming value first.
 */
export function mergeLibrary(current: Library, incoming: Library): Library {
  const deletedSourceUrls = mergeTombstones(current.deletedSourceUrls, incoming.deletedSourceUrls)
  const deletedMixtapeIds = mergeTombstones(current.deletedMixtapeIds, incoming.deletedMixtapeIds)
  const deletedAt = (tombstones: Tombstone[], id: string) =>
    tombstones.find((tombstone) => tombstone.id === id)?.deletedAt

  const sourcesByUrl = new Map(current.sources.map((source) => [source.url, source]))
  for (const source of incoming.sources) {
    const existing = sourcesByUrl.get(source.url)
    if (
      !existing ||
      freshestTimestamp(source.savedAt, source.lastPlayedAt) >=
        freshestTimestamp(existing.savedAt, existing.lastPlayedAt)
    ) {
      sourcesByUrl.set(source.url, source)
    }
  }
  const sources = [...sourcesByUrl.values()]
    // A tombstone at least as fresh as the entry means it was explicitly
    // deleted after (or as part of) that write, so drop it from the merge
    // instead of letting a stale remote copy resurrect it.
    .filter((source) => {
      const tombstone = deletedAt(deletedSourceUrls, source.url)
      return !tombstone || tombstone < freshestTimestamp(source.savedAt, source.lastPlayedAt)
    })
    .sort((a, b) => {
      const freshA = freshestTimestamp(a.savedAt, a.lastPlayedAt)
      const freshB = freshestTimestamp(b.savedAt, b.lastPlayedAt)
      return freshA < freshB ? 1 : freshA > freshB ? -1 : 0
    })
    .slice(0, MAX_SOURCES)

  const mixtapesById = new Map(current.mixtapes.map((mixtape) => [mixtape.id, mixtape]))
  for (const mixtape of incoming.mixtapes) {
    const existing = mixtapesById.get(mixtape.id)
    if (
      !existing ||
      freshestTimestamp(mixtape.updatedAt, mixtape.lastPlayedAt) >=
        freshestTimestamp(existing.updatedAt, existing.lastPlayedAt)
    ) {
      mixtapesById.set(mixtape.id, mixtape)
    }
  }
  const mixtapes = [...mixtapesById.values()].filter((mixtape) => {
    const tombstone = deletedAt(deletedMixtapeIds, mixtape.id)
    return !tombstone || tombstone < freshestTimestamp(mixtape.updatedAt, mixtape.lastPlayedAt)
  })

  return { ...current, sources, mixtapes, deletedSourceUrls, deletedMixtapeIds }
}

export function mixtapeToPlaylist(mixtape: Mixtape): Playlist {
  const firstPlayable = mixtape.tracks.find((track) => !track.unavailable)
  return {
    name: mixtape.name,
    kind: 'Mixtape',
    description: 'Hand-picked videos saved in Tapedeck',
    thumbnail: firstPlayable ? thumbnailUrl(firstPlayable.id) : '',
    sourceUrl: `tapedeck://mixtape/${mixtape.id}`,
    tracks: mixtape.tracks,
  }
}
