import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DesktopCommandError,
  getGoogleAuthStatus,
  isDesktopApp,
  signInWithGoogle,
  signOutGoogle,
  type AuthStatus,
} from './api/auth'
import { loadLibrary, saveLibrary } from './api/library'
import { resolveYouTubeSource, TapedeckApiError } from './api/youtube'
import { PlayerScreen } from './components/PlayerScreen'
import { WelcomeScreen } from './components/WelcomeScreen'
import { demoPlaylist, type Playlist, type Track } from './data/mockPlaylist'
import {
  createMixtape,
  deleteMixtape,
  emptyLibrary,
  mixtapeToPlaylist,
  removeSource,
  toggleMixtapeTrack,
  upsertSource,
  type Library,
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
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(desktop ? null : {
    configured: true,
    authenticated: true,
  })
  const [authAction, setAuthAction] = useState<'sign-in' | 'sign-out' | null>(null)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    loadLibrary().then((stored) => active && setLibrary(stored))
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
      mutateLibrary((current) => upsertSource(current, {
        url: targetUrl,
        name: nextPlaylist.name,
        kind: nextPlaylist.kind,
        thumbnail: nextPlaylist.thumbnail || '',
      }))
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof TapedeckApiError ? loadError.message : 'Tapedeck could not load that source.')
      setView('welcome')
    }
  }

  function handlePlayMixtape(mixtapeId: string) {
    const mixtape = library.mixtapes.find((entry) => entry.id === mixtapeId)
    if (!mixtape || mixtape.tracks.length === 0) return
    requestController.current?.abort()
    setError('')
    setPlaylist(null)
    setPlayingMixtapeId(mixtapeId)
    setView('loaded')
  }

  function handleDeleteMixtape(mixtapeId: string) {
    const mixtape = library.mixtapes.find((entry) => entry.id === mixtapeId)
    if (!mixtape) return
    if (!window.confirm(`Delete the mixtape “${mixtape.name}”? This cannot be undone.`)) return
    commitLibrary(deleteMixtape(library, mixtapeId))
    if (playingMixtapeId === mixtapeId) {
      setPlayingMixtapeId(null)
      setView('welcome')
    }
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

  const playingMixtape = playingMixtapeId
    ? library.mixtapes.find((entry) => entry.id === playingMixtapeId) ?? null
    : null
  const activePlaylist = useMemo(
    () => (playingMixtape ? mixtapeToPlaylist(playingMixtape) : playlist),
    [playingMixtape, playlist],
  )

  if (view === 'loaded' && activePlaylist && activePlaylist.tracks.length > 0) {
    return (
      <PlayerScreen
        playlist={activePlaylist}
        mixtapes={library.mixtapes}
        activeMixtapeId={playingMixtapeId}
        onChangeSource={() => setView('welcome')}
        onToggleMixtapeTrack={handleToggleMixtapeTrack}
        onCreateMixtape={(name, track) => commitLibrary(createMixtape(library, name, track))}
      />
    )
  }

  return (
    <WelcomeScreen
      url={url}
      error={error}
      loading={view === 'loading'}
      desktop={desktop}
      authStatus={authStatus}
      authAction={authAction}
      sources={library.sources}
      mixtapes={library.mixtapes}
      onUrlChange={(value) => {
        setUrl(value)
        setError('')
      }}
      onSubmit={handleLoad}
      onOpenSource={(sourceUrl) => handleLoad(sourceUrl)}
      onRemoveSource={(sourceUrl) => commitLibrary(removeSource(library, sourceUrl))}
      onPlayMixtape={handlePlayMixtape}
      onDeleteMixtape={handleDeleteMixtape}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onOpenDemo={() => {
        requestController.current?.abort()
        setError('')
        setPlaylist(demoPlaylist)
        setPlayingMixtapeId(null)
        setView('loaded')
      }}
    />
  )
}
