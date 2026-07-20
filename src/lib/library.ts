import { Playlist, thumbnailUrl, Track } from '../data/mockPlaylist'

export type SavedSource = {
  url: string
  name: string
  kind: string
  thumbnail: string
  savedAt: string
}

export type Mixtape = {
  id: string
  name: string
  createdAt: string
  tracks: Track[]
}

export type Library = {
  version: 1
  sources: SavedSource[]
  mixtapes: Mixtape[]
}

const MAX_SOURCES = 30

export function emptyLibrary(): Library {
  return { version: 1, sources: [], mixtapes: [] }
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
  const candidate = value as { sources?: unknown; mixtapes?: unknown }

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
        tracks: mixtape.tracks.filter(
          (track): track is Track =>
            Boolean(track && typeof track.id === 'string' && typeof track.title === 'string'),
        ),
      }))
  }

  return library
}

/** Save a successfully loaded source, most recent first, deduplicated by URL. */
export function upsertSource(
  library: Library,
  source: Omit<SavedSource, 'savedAt'>,
): Library {
  const entry: SavedSource = { ...source, savedAt: new Date().toISOString() }
  const others = library.sources.filter((existing) => existing.url !== source.url)
  return { ...library, sources: [entry, ...others].slice(0, MAX_SOURCES) }
}

export function removeSource(library: Library, url: string): Library {
  return { ...library, sources: library.sources.filter((source) => source.url !== url) }
}

export function createMixtape(library: Library, name: string, firstTrack: Track): Library {
  const mixtape: Mixtape = {
    id: generateId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
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
      return mixtapeHasTrack(mixtape, track.id)
        ? { ...mixtape, tracks: mixtape.tracks.filter((existing) => existing.id !== track.id) }
        : { ...mixtape, tracks: [...mixtape.tracks, track] }
    }),
  }
}

export function deleteMixtape(library: Library, mixtapeId: string): Library {
  return { ...library, mixtapes: library.mixtapes.filter((mixtape) => mixtape.id !== mixtapeId) }
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
