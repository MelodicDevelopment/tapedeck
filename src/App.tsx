import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DesktopCommandError,
  getGoogleAuthStatus,
  isDesktopApp,
  signInWithGoogle,
  signOutGoogle,
  type AuthStatus,
} from './api/auth'
import { exportLibrary, loadLibrary, saveLibrary } from './api/library'
import { syncLibrary, type SyncedDevice } from './api/sync'
import { checkForUpdate, type UpdateInfo } from './api/updates'
import { resolveYouTubeSource, TapedeckApiError } from './api/youtube'
import { ConfirmDialog } from './components/ConfirmDialog'
import { PlayerScreen } from './components/PlayerScreen'
import type { SyncStatus } from './components/SyncChip'
import { WelcomeScreen } from './components/WelcomeScreen'
import type { Playlist, Track } from './data/mockPlaylist'
import {
  createMixtape,
  deleteMixtape,
  emptyLibrary,
  mergeLibrary,
  mixtapeToPlaylist,
  normalizeLibrary,
  type PlaybackTarget,
  recordPlaybackProgress,
  removeSource,
  reorderMixtapeTrack,
  toggleMixtapeTrack,
  touchLastPlayed,
  upsertSource,
  type Library,
  type Mixtape,
  type PlaybackSettings,
} from './lib/library'
import { validateYouTubeSource } from './lib/validation'

type View = 'welcome' | 'loading' | 'loaded'

export default function App() {
  const desktop = isDesktopApp()
  const [view, setView] = useState<View>('welcome')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [library, setLibrary] = useState<Library>(emptyLibrary)
  const [playingMixtapeId, setPlayingMixtapeId] = useState<string | null>(null)
  const [confirmDeleteMixtape, setConfirmDeleteMixtape] = useState<Mixtape | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(desktop ? null : {
    configured: true,
    authenticated: true,
  })
  const [authAction, setAuthAction] = useState<'sign-in' | 'sign-out' | null>(null)
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncDevices, setSyncDevices] = useState<SyncedDevice[]>([])
  const [syncError, setSyncError] = useState('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    loadLibrary().then((stored) => {
      if (!active) return
      setLibrary(stored)
      setLibraryLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!desktop) return
    let active = true
    getGoogleAuthStatus()
      .then((status) => active && setAuthStatus(status))
      .catch((authError) => {
        if (!active) return
        setAuthStatus({ configured: true, authenticated: false })
        setError(authError instanceof DesktopCommandError ? authError.message : 'Tapedeck could not check Google sign-in.')
      })
    return () => {
      active = false
    }
  }, [desktop])

  useEffect(() => {
    if (!desktop) return
    let active = true
    checkForUpdate()
      .then((info) => active && setUpdateInfo(info))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [desktop])

  function commitLibrary(next: Library) {
    setLibrary(next)
    saveLibrary(next)
  }

  // For async flows where `library` may be stale by the time the work
  // finishes; applies the change to whatever the current library is.
  function mutateLibrary(update: (current: Library) => Library) {
    setLibrary((current) => {
      const next = update(current)
      saveLibrary(next)
      return next
    })
  }

  async function handleSignIn() {
    setError('')
    setAuthAction('sign-in')
    try {
      setAuthStatus(await signInWithGoogle())
    } catch (authError) {
      setError(authError instanceof DesktopCommandError ? authError.message : 'Tapedeck could not complete Google sign-in.')
    } finally {
      setAuthAction(null)
    }
  }

  async function handleSignOut() {
    requestController.current?.abort()
    setError('')
    setAuthAction('sign-out')
    try {
      setAuthStatus(await signOutGoogle())
      setPlaylist(null)
      setPlayingMixtapeId(null)
      setView('welcome')
    } catch (authError) {
      setError(authError instanceof DesktopCommandError ? authError.message : 'Tapedeck could not sign out of Google.')
    } finally {
      setAuthAction(null)
    }
  }

  async function handleLoad(requestedUrl?: string) {
    const targetUrl = (requestedUrl ?? url).trim()
    if (requestedUrl) setUrl(requestedUrl)

    if (desktop && !authStatus?.authenticated) {
      setError('Sign in with Google before loading a YouTube channel or playlist.')
      return
    }
    const validationError = validateYouTubeSource(targetUrl)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setView('loading')
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller

    try {
      const nextPlaylist = await resolveYouTubeSource(targetUrl, controller.signal)
      setPlaylist(nextPlaylist)
      setPlayingMixtapeId(null)
      setView('loaded')
      mutateLibrary((current) =>
        touchLastPlayed(
          upsertSource(current, {
            url: targetUrl,
            name: nextPlaylist.name,
            kind: nextPlaylist.kind,
            thumbnail: nextPlaylist.thumbnail || '',
            tracks: nextPlaylist.tracks,
          }),
          { type: 'source', url: targetUrl },
        ),
      )
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof TapedeckApiError ? loadError.message : 'Tapedeck could not load that source.')
      setView('welcome')
    }
  }

  /**
   * Opens an already-saved source instantly from its cached track list (no
   * loading state), then silently re-resolves from YouTube in the
   * background and swaps in the fresh result when it lands. Falls back to
   * a normal (spinner-shown) load for a source saved before caching
   * existed, or any URL that isn't saved yet.
   */
  function openSavedSource(sourceUrl: string) {
    const saved = library.sources.find((entry) => entry.url === sourceUrl)
    if (!saved || saved.tracks.length === 0) {
      handleLoad(sourceUrl)
      return
    }

    requestController.current?.abort()
    setError('')
    setUrl(sourceUrl)
    setPlaylist({
      name: saved.name,
      kind: saved.kind,
      description: '',
      thumbnail: saved.thumbnail,
      sourceUrl: saved.url,
      tracks: saved.tracks,
    })
    setPlayingMixtapeId(null)
    setView('loaded')
    mutateLibrary((current) => touchLastPlayed(current, { type: 'source', url: sourceUrl }))

    const controller = new AbortController()
    requestController.current = controller
    resolveYouTubeSource(sourceUrl, controller.signal)
      .then((fresh) => {
        setPlaylist((current) => (current && current.sourceUrl === sourceUrl ? fresh : current))
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

  function handlePlayMixtape(mixtapeId: string) {
    const mixtape = library.mixtapes.find((entry) => entry.id === mixtapeId)
    if (!mixtape || mixtape.tracks.length === 0) return
    requestController.current?.abort()
    setError('')
    setPlaylist(null)
    setPlayingMixtapeId(mixtapeId)
    setView('loaded')
    mutateLibrary((current) => touchLastPlayed(current, { type: 'mixtape', id: mixtapeId }))
  }

  function handleDeleteMixtape(mixtapeId: string) {
    const mixtape = library.mixtapes.find((entry) => entry.id === mixtapeId)
    if (!mixtape) return
    setConfirmDeleteMixtape(mixtape)
  }

  function confirmDeleteMixtapeNow() {
    if (!confirmDeleteMixtape) return
    const mixtapeId = confirmDeleteMixtape.id
    commitLibrary(deleteMixtape(library, mixtapeId))
    if (playingMixtapeId === mixtapeId) {
      setPlayingMixtapeId(null)
      setView('welcome')
    }
    setConfirmDeleteMixtape(null)
  }

  function handleToggleMixtapeTrack(mixtapeId: string, track: Track) {
    const next = toggleMixtapeTrack(library, mixtapeId, track)
    commitLibrary(next)
    const playing = next.mixtapes.find((entry) => entry.id === playingMixtapeId)
    if (playingMixtapeId && (!playing || playing.tracks.length === 0)) {
      setPlayingMixtapeId(null)
      setView('welcome')
    }
  }

  function handleReorderMixtapeTrack(mixtapeId: string, fromIndex: number, toIndex: number) {
    commitLibrary(reorderMixtapeTrack(library, mixtapeId, fromIndex, toIndex))
  }

  function handleExportLibrary() {
    return exportLibrary(library)
  }

  function handleImportLibrary(raw: unknown) {
    commitLibrary(mergeLibrary(library, normalizeLibrary(raw)))
  }

  // Refs so the sync effects below can read the latest values without
  // re-registering their timers on every render.
  const libraryRef = useRef(library)
  libraryRef.current = library
  const authStatusRef = useRef(authStatus)
  authStatusRef.current = authStatus
  const syncingRef = useRef(false)
  // A library change caused by a sync completing shouldn't itself schedule
  // another sync — only genuine local edits should.
  const skipNextSyncTriggerRef = useRef(false)

  const handleSyncNow = useCallback(() => {
    if (!desktop || syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')
    setSyncError('')
    syncLibrary(libraryRef.current)
      .then((result) => {
        skipNextSyncTriggerRef.current = true
        setLibrary(result.library)
        saveLibrary(result.library)
        setSyncDevices(result.devices)
        setSyncStatus('synced')
      })
      .catch((syncError: unknown) => {
        const message = syncError instanceof Error ? syncError.message : 'Tapedeck could not sync your library.'
        setSyncError(message)
        setSyncStatus(/reach|connection|offline/i.test(message) ? 'offline' : 'error')
      })
      .finally(() => {
        syncingRef.current = false
      })
  }, [desktop])

  // Sync once on launch, after the local library has actually loaded (never
  // sync a still-default/empty library up over real Drive data).
  useEffect(() => {
    if (!desktop || !libraryLoaded || !authStatus?.authenticated) return
    handleSyncNow()
    // handleSyncNow is stable (see its own useCallback); re-running only on
    // these three becoming true is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, libraryLoaded, authStatus?.authenticated])

  // Periodic background sync so the library stays current without the user
  // having to remember to hit "Sync now".
  useEffect(() => {
    if (!desktop) return
    const interval = setInterval(() => {
      if (authStatusRef.current?.authenticated) handleSyncNow()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [desktop, handleSyncNow])

  // Debounced sync shortly after any local library change (new source,
  // mixtape edit, playback settings, resume position, ...).
  const isFirstLibraryChange = useRef(true)
  useEffect(() => {
    if (!desktop) return
    if (isFirstLibraryChange.current) {
      isFirstLibraryChange.current = false
      return
    }
    if (skipNextSyncTriggerRef.current) {
      skipNextSyncTriggerRef.current = false
      return
    }
    const timeout = setTimeout(() => {
      if (authStatusRef.current?.authenticated) handleSyncNow()
    }, 8000)
    return () => clearTimeout(timeout)
  }, [library, desktop, handleSyncNow])

  // Stable identity: PlayerScreen depends on this in a useEffect, so a
  // fresh closure every render would refire that effect (and re-save)
  // on every unrelated App re-render.
  const handlePlaybackSettingsChange = useCallback((settings: PlaybackSettings) => {
    setLibrary((current) => {
      const next = { ...current, playbackSettings: settings }
      saveLibrary(next)
      return next
    })
  }, [])

  // Same stable-identity reasoning as above, via refs since this fires from
  // a periodic interval inside PlayerScreen rather than a debounced effect.
  const playingMixtapeIdRef = useRef<string | null>(null)
  playingMixtapeIdRef.current = playingMixtapeId
  const playlistRef = useRef<Playlist | null>(null)
  playlistRef.current = playlist

  const handlePlaybackProgress = useCallback((trackId: string, positionSecs: number) => {
    const target: PlaybackTarget = playingMixtapeIdRef.current
      ? { type: 'mixtape', id: playingMixtapeIdRef.current }
      : { type: 'source', url: playlistRef.current?.sourceUrl ?? '' }
    if (target.type === 'source' && !target.url) return
    setLibrary((current) => {
      const next = recordPlaybackProgress(current, target, trackId, positionSecs)
      saveLibrary(next)
      return next
    })
  }, [])

  const playingMixtape = playingMixtapeId
    ? library.mixtapes.find((entry) => entry.id === playingMixtapeId) ?? null
    : null
  const activePlaylist = useMemo(
    () => (playingMixtape ? mixtapeToPlaylist(playingMixtape) : playlist),
    [playingMixtape, playlist],
  )
  const hasPlayer = Boolean(activePlaylist && activePlaylist.tracks.length > 0)
  const resumeSource = !playingMixtapeId && playlist
    ? library.sources.find((entry) => entry.url === playlist.sourceUrl)
    : undefined
  const initialResumeTrackId = playingMixtape?.lastTrackId ?? resumeSource?.lastTrackId
  const initialResumePositionSecs = playingMixtape?.lastPositionSecs ?? resumeSource?.lastPositionSecs

  return (
    <>
      {updateInfo && !updateDismissed && (
        <div className="update-banner" role="status">
          <span>
            Tapedeck {updateInfo.latestVersion} is available (you have {updateInfo.currentVersion}).
          </span>
          <a href={updateInfo.releaseUrl} target="_blank" rel="noreferrer" className="update-banner__link">
            Get the update
          </a>
          <button
            type="button"
            className="update-banner__dismiss"
            onClick={() => setUpdateDismissed(true)}
            aria-label="Dismiss update notice"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      {hasPlayer && activePlaylist && (
        <PlayerScreen
          key={activePlaylist.sourceUrl}
          playlist={activePlaylist}
          mixtapes={library.mixtapes}
          sources={library.sources}
          activeMixtapeId={playingMixtapeId}
          authStatus={authStatus}
          authAction={authAction}
          initialShuffle={library.playbackSettings.shuffle}
          initialRepeatMode={library.playbackSettings.repeatMode}
          initialVolume={library.playbackSettings.volume}
          initialResumeTrackId={initialResumeTrackId}
          initialResumePositionSecs={initialResumePositionSecs}
          onChangeSource={() => setView('welcome')}
          onSelectSource={openSavedSource}
          onSelectMixtape={handlePlayMixtape}
          onToggleMixtapeTrack={handleToggleMixtapeTrack}
          onReorderMixtapeTrack={handleReorderMixtapeTrack}
          onCreateMixtape={(name, track) => commitLibrary(createMixtape(library, name, track))}
          onPlaybackSettingsChange={handlePlaybackSettingsChange}
          onPlaybackProgress={handlePlaybackProgress}
          onSignOut={handleSignOut}
        />
      )}
      {(!hasPlayer || view !== 'loaded') && (
        <WelcomeScreen
          url={url}
          error={error}
          loading={view === 'loading'}
          desktop={desktop}
          authStatus={authStatus}
          authAction={authAction}
          sources={library.sources}
          mixtapes={library.mixtapes}
          overlay={hasPlayer}
          onClose={() => setView('loaded')}
          syncStatus={syncStatus}
          syncDevices={syncDevices}
          syncError={syncError}
          onSyncNow={handleSyncNow}
          onUrlChange={(value) => {
            setUrl(value)
            setError('')
          }}
          onSubmit={handleLoad}
          onOpenSource={openSavedSource}
          onRemoveSource={(sourceUrl) => commitLibrary(removeSource(library, sourceUrl))}
          onPlayMixtape={handlePlayMixtape}
          onDeleteMixtape={handleDeleteMixtape}
          onExportLibrary={handleExportLibrary}
          onImportLibrary={handleImportLibrary}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      )}

      {confirmDeleteMixtape && (
        <ConfirmDialog
          title="Delete mixtape"
          message={`Delete the mixtape "${confirmDeleteMixtape.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteMixtapeNow}
          onCancel={() => setConfirmDeleteMixtape(null)}
        />
      )}
    </>
  )
}
