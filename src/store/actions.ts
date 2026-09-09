import { SignalEffect } from '@melodicdev/core'
import { listen } from '@tauri-apps/api/event'
import { DesktopCommandError, getGoogleAuthStatus, signInWithGoogle, signOutGoogle } from '../api/auth'
import { exportLibrary, loadLibrary, saveLibrary } from '../api/library'
import { onMediaControl, updateMediaMetadata, updateMediaPlayback } from '../api/media'
import { syncLibrary } from '../api/sync'
import { restartToUpdate as installStagedUpdate, stageUpdate } from '../api/updates'
import { resolveVideo, resolveYouTubeSource, TapedeckApiError } from '../api/youtube'
import { thumbnailUrl, type Playlist, type Track } from '../data/mockPlaylist'
import {
  addMixtapeTracks,
  convertSourceToMixtape as libConvertSourceToMixtape,
  createMixtape as libCreateMixtape,
  deleteMixtape as libDeleteMixtape,
  mergeLibrary,
  mixtapeHasTrack,
  normalizeLibrary,
  recordPlaybackProgress,
  removeSource,
  reorderMixtapeTrack as libReorderMixtapeTrack,
  setSourceTrackHidden,
  toggleMixtapeTrack as libToggleMixtapeTrack,
  touchLastPlayed,
  upsertSource,
  type Library,
  type PlaybackTarget,
} from '../lib/library'
import { extractYouTubeVideoId, validateYouTubeSource, videoWatchUrl } from '../lib/validation'
import * as player from './player'
import {
  activePlaylist,
  authAction,
  authStatus,
  confirmDeleteMixtape,
  desktop,
  error,
  hasPlayer,
  library,
  libraryLoaded,
  playingMixtapeId,
  playlist,
  syncDevices,
  syncError,
  stagedUpdate,
  syncStatus,
  updateDismissed,
  url,
  view,
} from './state'

let requestController: AbortController | null = null

/** The active playlist's identity — React's key={sourceUrl}. Playback state is
 *  fully re-initialized only when this changes. */
let activeKey: string | undefined

/** A library change caused by a sync completing (or the initial disk load)
 *  shouldn't itself schedule another sync — only genuine local edits should. */
let suppressSyncTrigger = false

function commitLibrary(next: Library): void {
  library.set(next)
  saveLibrary(next)
}

/** For async flows where the library may have changed since the work started;
 *  applies the change to whatever the current library is. */
function mutateLibrary(update: (current: Library) => Library): void {
  const next = update(library())
  library.set(next)
  saveLibrary(next)
}

/** Persists the current queue position — the periodic checkpoint, and the
 *  flush the React build did on PlayerScreen unmount. Reads the *current*
 *  signals, so call it before switching away from a source. */
function recordProgress(): void {
  const trackId = player.queueTrackId()
  if (!trackId) return
  const mixtapeId = playingMixtapeId()
  const target: PlaybackTarget = mixtapeId
    ? { type: 'mixtape', id: mixtapeId }
    : { type: 'source', url: playlist()?.sourceUrl ?? '' }
  if (target.type === 'source' && !target.url) return
  mutateLibrary((current) => recordPlaybackProgress(current, target, trackId, player.elapsedNow))
}

/** The React build flushed progress when PlayerScreen unmounted, while its
 *  refs still pointed at the outgoing source. Call this BEFORE mutating
 *  playlist/playingMixtapeId so the position lands on the right target. */
function flushProgressForCurrent(): void {
  if (hasPlayer()) recordProgress()
}

/** Switches the active playlist "key", resetting playback for the incoming
 *  source (React's remount-on-key). Progress for the outgoing source must
 *  already have been flushed via flushProgressForCurrent(). */
function activate(key: string, resumeTrackId?: string, resumePositionSecs?: number): void {
  if (key === activeKey) {
    return
  }
  activeKey = key
  player.initPlayback(resumeTrackId, resumePositionSecs)
}

function stopPlayback(): void {
  activeKey = undefined
  playlist.set(null)
  playingMixtapeId.set(null)
  view.set('welcome')
}

export function setUrl(value: string): void {
  url.set(value)
  error.set('')
}

export function dismissUpdate(): void {
  updateDismissed.set(true)
}

export function restartToUpdate(): void {
  installStagedUpdate().catch(() => {
    error.set('Tapedeck could not install the update. Quit and reopen to try again.')
  })
}

export function closeOverlay(): void {
  view.set('loaded')
}

export function changeSource(): void {
  view.set('welcome')
}

export async function signIn(): Promise<void> {
  error.set('')
  authAction.set('sign-in')
  try {
    authStatus.set(await signInWithGoogle())
  } catch (authError) {
    error.set(
      authError instanceof DesktopCommandError
        ? authError.message
        : 'Tapedeck could not complete Google sign-in.',
    )
  } finally {
    authAction.set(null)
  }
}

export async function signOut(): Promise<void> {
  requestController?.abort()
  error.set('')
  authAction.set('sign-out')
  try {
    const status = await signOutGoogle()
    flushProgressForCurrent()
    authStatus.set(status)
    stopPlayback()
  } catch (authError) {
    error.set(
      authError instanceof DesktopCommandError
        ? authError.message
        : 'Tapedeck could not sign out of Google.',
    )
  } finally {
    authAction.set(null)
  }
}

export async function handleLoad(requestedUrl?: string): Promise<void> {
  const targetUrl = (requestedUrl ?? url()).trim()
  if (requestedUrl) url.set(requestedUrl)

  if (desktop && !authStatus()?.authenticated) {
    error.set('Sign in with Google before loading a YouTube video, channel, or playlist.')
    return
  }
  const validationError = validateYouTubeSource(targetUrl)
  if (validationError) {
    error.set(validationError)
    return
  }

  error.set('')
  view.set('loading')
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller

  try {
    const nextPlaylist = await resolveYouTubeSource(targetUrl, controller.signal)
    const previousQueueTrackId = player.queueTrackId()
    if (nextPlaylist.sourceUrl !== activeKey) flushProgressForCurrent()
    // Saved under the canonical URL so the library entry, the playlist's
    // sourceUrl, and the progress/hidden-track lookups all share one key.
    const savedUrl = nextPlaylist.sourceUrl || targetUrl
    mutateLibrary((current) => {
      let next = current
      const typed = targetUrl !== savedUrl ? current.sources.find((entry) => entry.url === targetUrl) : undefined
      if (typed) {
        // Migrate an entry saved under the URL as typed: carry its state over.
        next = removeSource(next, targetUrl)
        next = {
          ...next,
          sources: [
            { ...typed, url: savedUrl },
            ...next.sources.filter((entry) => entry.url !== savedUrl),
          ],
        }
      }
      return touchLastPlayed(
        upsertSource(next, {
          url: savedUrl,
          name: nextPlaylist.name,
          kind: nextPlaylist.kind,
          thumbnail: nextPlaylist.thumbnail || '',
          tracks: nextPlaylist.tracks,
        }),
        { type: 'source', url: savedUrl },
      )
    })
    playlist.set(nextPlaylist)
    playingMixtapeId.set(null)
    view.set('loaded')
    if (nextPlaylist.sourceUrl === activeKey) {
      player.syncWithPlaylist(previousQueueTrackId)
    } else {
      const saved = library().sources.find((entry) => entry.url === nextPlaylist.sourceUrl)
      activate(nextPlaylist.sourceUrl, saved?.lastTrackId, saved?.lastPositionSecs)
    }
  } catch (loadError) {
    if (loadError instanceof DOMException && loadError.name === 'AbortError') return
    error.set(
      loadError instanceof TapedeckApiError
        ? loadError.message
        : 'Tapedeck could not load that source.',
    )
    view.set('welcome')
  }
}

/**
 * Opens an already-saved source instantly from its cached track list (no
 * loading state), then silently re-resolves from YouTube in the background
 * and swaps in the fresh result when it lands. Falls back to a normal
 * (spinner-shown) load for a source saved before caching existed, or any
 * URL that isn't saved yet.
 */
export function openSavedSource(sourceUrl: string): void {
  const saved = library().sources.find((entry) => entry.url === sourceUrl)
  if (!saved || saved.tracks.length === 0) {
    void handleLoad(sourceUrl)
    return
  }

  requestController?.abort()
  error.set('')
  url.set(sourceUrl)
  const previousQueueTrackId = player.queueTrackId()
  if (sourceUrl !== activeKey) flushProgressForCurrent()
  playlist.set({
    name: saved.name,
    kind: saved.kind,
    description: '',
    thumbnail: saved.thumbnail,
    sourceUrl: saved.url,
    tracks: saved.tracks,
  })
  playingMixtapeId.set(null)
  view.set('loaded')
  mutateLibrary((current) => touchLastPlayed(current, { type: 'source', url: sourceUrl }))
  if (sourceUrl === activeKey) {
    player.syncWithPlaylist(previousQueueTrackId)
  } else {
    activate(sourceUrl, saved.lastTrackId, saved.lastPositionSecs)
  }

  const controller = new AbortController()
  requestController = controller
  resolveYouTubeSource(sourceUrl, controller.signal)
    .then((fresh) => {
      if (playlist()?.sourceUrl === sourceUrl) {
        const queueTrackId = player.queueTrackId()
        playlist.set(fresh)
        player.syncWithPlaylist(queueTrackId)
      }
      mutateLibrary((current) =>
        upsertSource(current, {
          url: sourceUrl,
          name: fresh.name,
          kind: fresh.kind,
          thumbnail: fresh.thumbnail || '',
          tracks: fresh.tracks,
        }),
      )
    })
    .catch(() => {
      // Cached data is already showing and playable — a failed background
      // refresh (offline, revoked auth, etc.) isn't worth surfacing.
    })
}

export function playMixtape(mixtapeId: string): void {
  const mixtape = library().mixtapes.find((entry) => entry.id === mixtapeId)
  if (!mixtape || mixtape.tracks.length === 0) return
  requestController?.abort()
  error.set('')
  const previousQueueTrackId = player.queueTrackId()
  const key = `tapedeck://mixtape/${mixtapeId}`
  if (key !== activeKey) flushProgressForCurrent()
  playlist.set(null)
  playingMixtapeId.set(mixtapeId)
  view.set('loaded')
  mutateLibrary((current) => touchLastPlayed(current, { type: 'mixtape', id: mixtapeId }))
  if (key === activeKey) {
    player.syncWithPlaylist(previousQueueTrackId)
  } else {
    activate(key, mixtape.lastTrackId, mixtape.lastPositionSecs)
  }
}

export function requestDeleteMixtape(mixtapeId: string): void {
  const mixtape = library().mixtapes.find((entry) => entry.id === mixtapeId)
  if (!mixtape) return
  confirmDeleteMixtape.set(mixtape)
}

export function cancelDeleteMixtape(): void {
  confirmDeleteMixtape.set(null)
}

export function confirmDeleteMixtapeNow(): void {
  const mixtape = confirmDeleteMixtape()
  if (!mixtape) return
  commitLibrary(libDeleteMixtape(library(), mixtape.id))
  if (playingMixtapeId() === mixtape.id) {
    stopPlayback()
  }
  confirmDeleteMixtape.set(null)
}

export function toggleMixtapeTrack(mixtapeId: string, track: Track): void {
  const previousQueueTrackId = player.queueTrackId()
  const next = libToggleMixtapeTrack(library(), mixtapeId, track)
  commitLibrary(next)
  const playingId = playingMixtapeId()
  const playing = next.mixtapes.find((entry) => entry.id === playingId)
  if (playingId && (!playing || playing.tracks.length === 0)) {
    stopPlayback()
    return
  }
  if (playingId === mixtapeId) {
    player.syncWithPlaylist(previousQueueTrackId)
  }
}

export function reorderMixtapeTrack(mixtapeId: string, fromIndex: number, toIndex: number): void {
  const previousQueueTrackId = player.queueTrackId()
  commitLibrary(libReorderMixtapeTrack(library(), mixtapeId, fromIndex, toIndex))
  if (playingMixtapeId() === mixtapeId) {
    player.syncWithPlaylist(previousQueueTrackId)
  }
}

/** Hide a video from the loaded source's queue; playback moves on if it was current. */
export function hideSourceTrack(trackId: string): void {
  setTrackHidden(trackId, true)
}

export function unhideSourceTrack(trackId: string): void {
  setTrackHidden(trackId, false)
}

function setTrackHidden(trackId: string, hidden: boolean): void {
  const sourceUrl = playlist()?.sourceUrl
  if (!sourceUrl || playingMixtapeId()) return
  const previousQueueTrackId = player.queueTrackId()
  // Never hide the last visible video — there'd be nothing left to play.
  if (hidden && (activePlaylist()?.tracks.length ?? 0) <= 1) return
  commitLibrary(setSourceTrackHidden(library(), sourceUrl, trackId, hidden))
  player.syncWithPlaylist(previousQueueTrackId)
}

export function createMixtape(name: string, track: Track): void {
  commitLibrary(libCreateMixtape(library(), name, track))
}

/**
 * Turn a saved source (a single video, typically) into a mixtape of the same
 * name and drop the source. If that source is what's playing, playback
 * carries straight on as the new mixtape without restarting the track.
 */
export function convertSourceToMixtape(sourceUrl: string): string | null {
  const wasPlaying = !playingMixtapeId() && playlist()?.sourceUrl === sourceUrl
  if (wasPlaying) flushProgressForCurrent()
  const converted = libConvertSourceToMixtape(library(), sourceUrl)
  if (!converted) return null
  commitLibrary(converted.library)
  if (wasPlaying) {
    requestController?.abort()
    const previousQueueTrackId = player.queueTrackId()
    playlist.set(null)
    playingMixtapeId.set(converted.mixtape.id)
    // Same tracks, same position — just re-key the queue onto the mixtape
    // instead of resetting playback as a fresh load would.
    activeKey = `tapedeck://mixtape/${converted.mixtape.id}`
    player.syncWithPlaylist(previousQueueTrackId)
    mutateLibrary((current) => touchLastPlayed(current, { type: 'mixtape', id: converted.mixtape.id }))
  }
  return converted.mixtape.id
}

/**
 * Resolve a pasted YouTube video link and append it to a mixtape. Resolves
 * to the track that was added, or throws with a user-facing message.
 */
export async function addVideoToMixtape(mixtapeId: string, videoUrl: string): Promise<Track> {
  if (desktop && !authStatus()?.authenticated) {
    throw new Error('Sign in with Google before adding a YouTube video.')
  }
  const videoId = extractYouTubeVideoId(videoUrl)
  if (!videoId) {
    throw new Error("That doesn't look like a YouTube video link. Paste a single video URL.")
  }
  const mixtape = library().mixtapes.find((entry) => entry.id === mixtapeId)
  if (!mixtape) throw new Error('That mixtape no longer exists.')
  if (mixtapeHasTrack(mixtape, videoId)) throw new Error('That video is already in this mixtape.')

  let resolved: Playlist
  try {
    resolved = await resolveYouTubeSource(videoWatchUrl(videoId))
  } catch (loadError) {
    throw new Error(
      loadError instanceof TapedeckApiError ? loadError.message : 'Tapedeck could not load that video.',
    )
  }
  const track = resolved.tracks[0]
  if (!track) throw new Error('Tapedeck could not load that video.')

  const previousQueueTrackId = player.queueTrackId()
  mutateLibrary((current) => addMixtapeTracks(current, mixtapeId, [track]))
  if (playingMixtapeId() === mixtapeId) player.syncWithPlaylist(previousQueueTrackId)
  return track
}

export function removeSavedSource(sourceUrl: string): void {
  commitLibrary(removeSource(library(), sourceUrl))
}

export function exportCurrentLibrary(): Promise<boolean> {
  return exportLibrary(library())
}

export function importLibrary(raw: unknown): void {
  commitLibrary(mergeLibrary(library(), normalizeLibrary(raw)))
}

let syncing = false

export function syncNow(): void {
  if (!desktop || syncing) return
  syncing = true
  syncStatus.set('syncing')
  syncError.set('')
  syncLibrary(library())
    .then((result) => {
      suppressSyncTrigger = true
      library.set(result.library)
      saveLibrary(result.library)
      syncDevices.set(result.devices)
      syncStatus.set('synced')
    })
    .catch((caught: unknown) => {
      const message =
        caught instanceof Error ? caught.message : 'Tapedeck could not sync your library.'
      syncError.set(message)
      syncStatus.set(/reach|connection|offline/i.test(message) ? 'offline' : 'error')
    })
    .finally(() => {
      syncing = false
    })
}

/* ============================================================================
   Bootstrap: initial data loads, cross-cutting effects, OS integrations.
   Called once from main.ts.
   ============================================================================ */

export async function bootstrap(): Promise<void> {
  wireEffects()
  wireMediaIntegration()
  wireKeyboardShortcuts()

  loadLibrary().then((stored) => {
    suppressSyncTrigger = true
    library.set(stored)
    libraryLoaded.set(true)
  })

  if (desktop) {
    getGoogleAuthStatus()
      .then((status) => authStatus.set(status))
      .catch((authError) => {
        authStatus.set({ configured: true, authenticated: false })
        error.set(
          authError instanceof DesktopCommandError
            ? authError.message
            : 'Tapedeck could not check Google sign-in.',
        )
      })

    // Silent auto-update: download in the background; the "Restart to
    // update" pill only appears once the new version is fully staged.
    stageUpdate()
      .then((update) => stagedUpdate.set(update))
      .catch(() => {})

    // A related-video click inside the embedded YouTube player itself (its
    // "More videos" overlay, end screens) reaches here via a Tauri event —
    // see the `on_new_window` hook in src-tauri/src/lib.rs.
    void listen<string>('tapedeck://play-external-video', (event) => {
      if (!hasPlayer()) return
      player.saveQueueStateOnce()
      player.externalVideoLoading.set(true)
      resolveVideo(event.payload)
        .then((resolved) => player.showExternalVideo(resolved))
        .catch(() => {})
        .finally(() => player.externalVideoLoading.set(false))
    })
  }
}

/** Everything sync-worthy about a library except playback positions. */
function syncFingerprint(current: Library): string {
  return JSON.stringify([
    current.sources.map((source) => [source.url, source.savedAt, source.lastPlayedAt, source.hiddenTrackIds]),
    current.mixtapes.map((mixtape) => [mixtape.id, mixtape.updatedAt, mixtape.lastPlayedAt]),
    current.playbackSettings,
    current.deletedSourceUrls,
    current.deletedMixtapeIds,
  ])
}

function wireEffects(): void {
  // Debounced sync shortly after any local library change (new source,
  // mixtape edit, playback settings, resume position, ...).
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let sawFirstLibrary = false
  let lastSyncFingerprint = ''
  new SignalEffect(() => {
    const fingerprint = syncFingerprint(library())
    if (!desktop) return
    if (!sawFirstLibrary) {
      sawFirstLibrary = true
      lastSyncFingerprint = fingerprint
      return
    }
    if (suppressSyncTrigger) {
      suppressSyncTrigger = false
      lastSyncFingerprint = fingerprint
      return
    }
    // Resume-position checkpoints land every 15s while playing; they don't
    // warrant a round trip each time (the periodic sync and the next real
    // edit carry them). Only genuine edits schedule a sync.
    if (fingerprint === lastSyncFingerprint) return
    lastSyncFingerprint = fingerprint
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      if (authStatus()?.authenticated) syncNow()
    }, 8000)
  }).run()

  // Sync once on launch, after the local library has actually loaded (never
  // sync a still-default/empty library up over real Drive data).
  let launchSynced = false
  new SignalEffect(() => {
    if (!desktop || launchSynced) return
    if (libraryLoaded() && authStatus()?.authenticated) {
      launchSynced = true
      syncNow()
    }
  }).run()

  // Periodic background sync so the library stays current without the user
  // having to remember to hit "Sync now".
  if (desktop) {
    setInterval(() => {
      if (authStatus()?.authenticated) syncNow()
    }, 5 * 60 * 1000)
  }

  // Debounced so dragging the volume slider doesn't write to disk on every
  // tick; shuffle/repeat toggle rarely enough that the same short delay is
  // unnoticeable there too.
  let settingsTimer: ReturnType<typeof setTimeout> | undefined
  new SignalEffect(() => {
    const settings = {
      shuffle: player.shuffle(),
      repeatMode: player.repeatMode(),
      volume: player.volume(),
    }
    if (!hasPlayer()) return
    clearTimeout(settingsTimer)
    settingsTimer = setTimeout(() => {
      mutateLibrary((current) => ({ ...current, playbackSettings: settings }))
    }, 400)
  }).run()

  // Checkpoints the resume position periodically (elapsed ticks every 500ms
  // while playing, so this can't be a debounce on elapsed itself) so
  // switching away or closing the app doesn't lose more than a few seconds.
  setInterval(() => {
    if (hasPlayer()) recordProgress()
  }, 15000)
}

function wireMediaIntegration(): void {
  onMediaControl((event) => {
    if (hasPlayer()) player.handleMediaControl(event)
  })

  // Publish track info to the OS now-playing surface whenever it changes.
  new SignalEffect(() => {
    const current = player.track()
    const duration = player.duration()
    if (!hasPlayer() || !current) return
    updateMediaMetadata({
      title: current.title,
      artist: current.artist,
      coverUrl: current.unavailable ? undefined : thumbnailUrl(current.id),
      durationSecs: duration > 0 ? duration : undefined,
    })
  }).run()

  // Publish play/pause state so media keys route to Tapedeck. Reads
  // elapsedNow (not the signal) to avoid re-running on every progress tick.
  new SignalEffect(() => {
    player.track()
    const playing = player.playing()
    const unavailable = player.unavailable()
    if (!hasPlayer()) return
    updateMediaPlayback(playing && !unavailable, player.elapsedNow)
  }).run()
}

function wireKeyboardShortcuts(): void {
  window.addEventListener('keydown', (event) => {
    if (!hasPlayer()) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    // composedPath so typing inside an input within a shadow root is seen —
    // event.target at the window is just the host element.
    const target = event.composedPath()[0] as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      player.handleMediaControl({ action: 'toggle' })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      player.adjustVolume(5)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      player.adjustVolume(-5)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      player.handleMediaControl({ action: 'next' })
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      player.handleMediaControl({ action: 'previous' })
    } else if (event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault()
      player.toggleShuffle()
    } else if (event.key === '?') {
      event.preventDefault()
      player.shortcutsOpen.set(true)
    }
  })
}

/** Test-only: reset module-level flow state between test cases. */
export function resetActionState(): void {
  requestController = null
  activeKey = undefined
  suppressSyncTrigger = false
  syncing = false
}

// Re-exported so components have one import site for playlist context.
export { activePlaylist }
