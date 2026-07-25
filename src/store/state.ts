import { computed, signal } from '@melodicdev/core'
import { isDesktopApp, type AuthStatus } from '../api/auth'
import type { SyncedDevice } from '../api/sync'
import type { UpdateInfo } from '../api/updates'
import type { Playlist } from '../data/mockPlaylist'
import { mixtapeToPlaylist, type Library, type Mixtape, emptyLibrary } from '../lib/library'

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

export const updateInfo = signal<UpdateInfo | null>(null)
export const updateDismissed = signal(false)

export const playingMixtape = computed<Mixtape | null>(() => {
  const id = playingMixtapeId()
  return id ? library().mixtapes.find((entry) => entry.id === id) ?? null : null
})

/** What the player is actually playing: the active mixtape, else the loaded source. */
export const activePlaylist = computed<Playlist | null>(() => {
  const mixtape = playingMixtape()
  return mixtape ? mixtapeToPlaylist(mixtape) : playlist()
})

export const hasPlayer = computed(() => {
  const active = activePlaylist()
  return Boolean(active && active.tracks.length > 0)
})
