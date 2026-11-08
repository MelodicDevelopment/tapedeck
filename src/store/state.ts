import { computed, signal } from '@melodicdev/core'
import { isDesktopApp, type AuthStatus } from '../api/auth'
import type { SyncedDevice } from '../api/sync'
import type { SearchResult } from '../api/youtube'
import type { StagedUpdate } from '../api/updates'
import type { Playlist, Track } from '../data/mockPlaylist'
import { mixtapeToPlaylist, partitionSourceTracks, type Library, type Mixtape, emptyLibrary } from '../lib/library'

export type View = 'welcome' | 'loading' | 'loaded'
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
export type AuthAction = 'sign-in' | 'sign-out' | null

/** Shared reactive state. Components import these signals directly and read
 *  them in their templates; ComponentBase auto-subscribes and re-renders. */
export const desktop = isDesktopApp()

export const view = signal<View>('welcome')
export const url = signal('')
export const error = signal('')
export const playlist = signal<Playlist | null>(null)
export const library = signal<Library>(emptyLibrary())
export const libraryLoaded = signal(false)
export const playingMixtapeId = signal<string | null>(null)
export const confirmDeleteMixtape = signal<Mixtape | null>(null)

export const authStatus = signal<AuthStatus | null>(
  desktop ? null : { configured: true, authenticated: true },
)
export const authAction = signal<AuthAction>(null)

export const syncStatus = signal<SyncStatus>('idle')
export const syncDevices = signal<SyncedDevice[]>([])
export const syncError = signal('')

/** YouTube search (the "search or paste a link" fields). `searchResults` is
 *  null when no search is showing; the results screen replaces the library
 *  grid while it is non-null or a search is in flight. */
export type SearchStatus = 'idle' | 'loading' | 'error'
export const searchQuery = signal('')
export const searchResults = signal<SearchResult[] | null>(null)
export const searchStatus = signal<SearchStatus>('idle')
export const searchError = signal('')
export const searchActive = computed(() => searchResults() !== null || searchStatus() === 'loading')

/** Set once a newer release has been downloaded and is ready to install. */
export const stagedUpdate = signal<StagedUpdate | null>(null)
export const updateDismissed = signal(false)

export const playingMixtape = computed<Mixtape | null>(() => {
  const id = playingMixtapeId()
  return id ? library().mixtapes.find((entry) => entry.id === id) ?? null : null
})

/** The saved-library entry for the loaded source, if it has been saved. */
export const activeSource = computed(() => {
  const current = playlist()
  if (!current || playingMixtapeId()) return null
  return library().sources.find((entry) => entry.url === current.sourceUrl) ?? null
})

/** Tracks in the loaded source the user has hidden (not part of the queue). */
export const hiddenTracks = computed<Track[]>(() => {
  const current = playlist()
  const saved = activeSource()
  if (!current || !saved) return []
  return partitionSourceTracks(current.tracks, saved.hiddenTrackIds).hidden
})

/** What the player is actually playing: the active mixtape, else the loaded
 *  source minus any videos the user has hidden from it. */
let filteredCache: { source: Playlist; hiddenIds: readonly string[]; result: Playlist } | null = null
// The 15s progress checkpoint rewrites the playing mixtape's entry (new object,
// same tracks array), so cache the derived playlist on what actually renders.
let mixtapeCache: { id: string; name: string; tracks: readonly Track[]; result: Playlist } | null = null
export const activePlaylist = computed<Playlist | null>(() => {
  const mixtape = playingMixtape()
  if (mixtape) {
    if (
      mixtapeCache &&
      mixtapeCache.id === mixtape.id &&
      mixtapeCache.name === mixtape.name &&
      mixtapeCache.tracks === mixtape.tracks
    ) {
      return mixtapeCache.result
    }
    const result = mixtapeToPlaylist(mixtape)
    mixtapeCache = { id: mixtape.id, name: mixtape.name, tracks: mixtape.tracks, result }
    return result
  }
  const current = playlist()
  const saved = activeSource()
  if (!current || !saved || saved.hiddenTrackIds.length === 0) return current
  // Keep the same object while nothing relevant changed, so consumers that
  // key off playlist identity (queue auto-scroll, playback re-init) don't
  // fire on every unrelated library write (progress checkpoints, syncs).
  if (filteredCache && filteredCache.source === current && filteredCache.hiddenIds === saved.hiddenTrackIds) {
    return filteredCache.result
  }
  const { visible } = partitionSourceTracks(current.tracks, saved.hiddenTrackIds)
  const result = visible.length === current.tracks.length ? current : { ...current, tracks: visible }
  filteredCache = { source: current, hiddenIds: saved.hiddenTrackIds, result }
  return result
})

export const hasPlayer = computed(() => {
  const active = activePlaylist()
  return Boolean(active && active.tracks.length > 0)
})
