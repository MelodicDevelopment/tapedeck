import { useEffect, useRef, useState } from 'react'
import {
  DesktopCommandError,
  getGoogleAuthStatus,
  isDesktopApp,
  signInWithGoogle,
  signOutGoogle,
  type AuthStatus,
} from './api/auth'
import { resolveYouTubeSource, TapedeckApiError } from './api/youtube'
import { PlayerScreen } from './components/PlayerScreen'
import { WelcomeScreen } from './components/WelcomeScreen'
import { demoPlaylist, type Playlist } from './data/mockPlaylist'
import { validateYouTubeSource } from './lib/validation'

type View = 'welcome' | 'loading' | 'loaded'

export default function App() {
  const desktop = isDesktopApp()
  const [view, setView] = useState<View>('welcome')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(desktop ? null : {
    configured: true,
    authenticated: true,
  })
  const [authAction, setAuthAction] = useState<'sign-in' | 'sign-out' | null>(null)
  const requestController = useRef<AbortController | null>(null)

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
      setView('welcome')
    } catch (authError) {
      setError(authError instanceof DesktopCommandError ? authError.message : 'Tapedeck could not sign out of Google.')
    } finally {
      setAuthAction(null)
    }
  }

  async function handleLoad() {
    if (desktop && !authStatus?.authenticated) {
      setError('Sign in with Google before loading a YouTube channel or playlist.')
      return
    }
    const validationError = validateYouTubeSource(url)
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
      const nextPlaylist = await resolveYouTubeSource(url.trim(), controller.signal)
      setPlaylist(nextPlaylist)
      setView('loaded')
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof TapedeckApiError ? loadError.message : 'Tapedeck could not load that source.')
      setView('welcome')
    }
  }

  if (view === 'loaded' && playlist) {
    return <PlayerScreen playlist={playlist} onChangeSource={() => setView('welcome')} />
  }

  return (
    <WelcomeScreen
      url={url}
      error={error}
      loading={view === 'loading'}
      desktop={desktop}
      authStatus={authStatus}
      authAction={authAction}
      onUrlChange={(value) => {
        setUrl(value)
        setError('')
      }}
      onSubmit={handleLoad}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onOpenDemo={() => {
        requestController.current?.abort()
        setError('')
        setPlaylist(demoPlaylist)
        setView('loaded')
      }}
    />
  )
}
