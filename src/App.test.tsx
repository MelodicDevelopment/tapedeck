import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => Boolean(Reflect.get(globalThis, 'isTauri')),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

const apiPlaylist = {
  name: 'Fetched playlist',
  kind: 'YouTube playlist',
  description: 'From the API',
  thumbnail: 'https://example.com/thumb.jpg',
  sourceUrl: 'https://www.youtube.com/playlist?list=PL123',
  tracks: [
    { id: 'dQw4w9WgXcQ', title: 'Fetched song', artist: 'Fetched artist', duration: 213 },
    { id: 'private-video', title: 'Private song', artist: 'Unavailable on YouTube', duration: 0, unavailable: true },
  ],
}

const twoTrackPlaylist = {
  name: 'Two Track Playlist',
  kind: 'YouTube playlist',
  description: 'From the API',
  thumbnail: 'https://example.com/thumb2.jpg',
  sourceUrl: 'https://www.youtube.com/playlist?list=PL999',
  tracks: [
    { id: 'trackA', title: 'Track A', artist: 'Artist A', duration: 200 },
    { id: 'trackB', title: 'Track B', artist: 'Artist B', duration: 200 },
  ],
}

describe('Tapedeck', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(invoke).mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(apiPlaylist), { status: 200, headers: { 'content-type': 'application/json' } }),
    ))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'YT')
  })

  function installYouTubePlayerThatReplacesItsMountNode() {
    class FakePlayer {
      private iframe: HTMLIFrameElement

      constructor(elementId: string) {
        const mountNode = document.getElementById(elementId)
        this.iframe = document.createElement('iframe')
        mountNode?.replaceWith(this.iframe)
      }

      destroy() {
        this.iframe.remove()
      }

      getCurrentTime() {
        return 0
      }

      getDuration() {
        return 213
      }

      setVolume() {}
      playVideo() {}
      pauseVideo() {}
      seekTo() {}
    }

    window.YT = {
      Player: FakePlayer,
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    } as unknown as typeof YT
  }

  it('shows validation feedback for an empty submission', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Paste a YouTube channel or playlist URL first.')
  })

  it('loads a resolved listening queue and exposes the unavailable state', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@lofihiphopmusic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByRole('status')).toHaveTextContent('Fetching from YouTube')

    expect(await screen.findByRole('heading', { name: 'Fetched song' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tracks')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Private song/ }))
    expect(screen.getByRole('status')).toHaveTextContent('This video is unavailable')
    expect(screen.getByRole('button', { name: 'Skip to next' })).toBeInTheDocument()
  })

  it('keeps the player mounted when selecting another track', async () => {
    installYouTubePlayerThatReplacesItsMountNode()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(twoTrackPlaylist), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    render(<App />)

    fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@two-tracks' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(await screen.findByRole('heading', { name: 'Track A' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next track' }))

    expect(screen.getByRole('heading', { name: 'Track B' })).toBeInTheDocument()
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument()
  })

  it('switches to audio mode without unmounting the video player', async () => {
    installYouTubePlayerThatReplacesItsMountNode()
    render(<App />)

    fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@lofihiphopmusic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await screen.findByLabelText('Now playing')
    const iframe = document.querySelector('.youtube-player iframe')
    expect(iframe).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Audio' }))
    expect(screen.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
    // Same iframe node, now just visually hidden — not unmounted/recreated,
    // so playback continues uninterrupted.
    expect(document.querySelector('.video-frame--hidden')).toBeInTheDocument()
    expect(document.querySelector('.youtube-player iframe')).toBe(iframe)

    fireEvent.click(screen.getByRole('button', { name: 'Show video' }))
    expect(screen.getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.video-frame--hidden')).not.toBeInTheDocument()
  })

  it('opens a saved source instantly from cache, resuming at the saved track and position', async () => {
    installYouTubePlayerThatReplacesItsMountNode()
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(twoTrackPlaylist), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    window.localStorage.setItem('tapedeck.library.v1', JSON.stringify({
      version: 1,
      sources: [{
        url: twoTrackPlaylist.sourceUrl,
        name: twoTrackPlaylist.name,
        kind: twoTrackPlaylist.kind,
        thumbnail: '',
        savedAt: new Date(0).toISOString(),
        tracks: twoTrackPlaylist.tracks,
        lastTrackId: 'trackB',
        lastPositionSecs: 42,
        lastPlayedAt: new Date(0).toISOString(),
      }],
      mixtapes: [],
      playbackSettings: { shuffle: false, repeatMode: 'off', volume: 70 },
    }))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Two Track Playlist' }))

    // Instant: no loading state, no network wait needed to see the player.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Track B' })).toBeInTheDocument()
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument()
  })

  it('keeps playing behind a dismissible Welcome overlay, reachable via the dropdown and the header home button', async () => {
    installYouTubePlayerThatReplacesItsMountNode()
    render(<App />)

    fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@lofihiphopmusic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(await screen.findByLabelText('Now playing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Switch from/ }))
    fireEvent.click(screen.getByRole('button', { name: /Load a new URL/ }))
    expect(screen.getByRole('button', { name: /Back to player/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Back to player/ }))
    expect(screen.queryByRole('button', { name: /Back to player/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to your library' }))
    expect(screen.getByRole('button', { name: /Back to player/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Now playing')).toBeInTheDocument()
  })

  it('surfaces server configuration errors in the welcome state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'API_NOT_CONFIGURED', message: 'The YouTube Data API is not configured yet.' },
    }), { status: 503, headers: { 'content-type': 'application/json' } }))
    render(<App />)
    fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@lofihiphopmusic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not configured')
  })

  it('shows a useful desktop setup state when the OAuth client ID is missing', async () => {
    vi.stubGlobal('isTauri', true)
    vi.mocked(invoke).mockResolvedValueOnce({
      configured: false,
      authenticated: false,
    })

    render(<App />)

    expect(await screen.findByText('Google sign-in needs configuration')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
    expect(screen.getByLabelText('YouTube channel or playlist URL')).toBeDisabled()
  })

  it('unlocks desktop URL loading after Google sign-in', async () => {
    vi.stubGlobal('isTauri', true)
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'google_auth_status') {
        return { configured: true, authenticated: false }
      }
      if (command === 'sign_in_with_google') {
        return {
          configured: true,
          authenticated: true,
          user: { name: 'Ada Listener', email: 'ada@example.com' },
        }
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByText('Ada Listener')).toBeInTheDocument()
    expect(screen.getByLabelText('YouTube channel or playlist URL')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled()
  })

  it('exports through the native save dialog on desktop and surfaces a failure', async () => {
    vi.stubGlobal('isTauri', true)
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'google_auth_status') {
        return { configured: true, authenticated: true, user: { name: 'Ada Listener', email: 'ada@example.com' } }
      }
      if (command === 'load_library') return null
      if (command === 'save_library') return undefined
      if (command === 'resolve_youtube_source') return apiPlaylist
      if (command === 'export_library') throw new Error('Could not write the library: disk full')
      if (command === 'drive_download_library') return null
      if (command === 'drive_upload_library') return undefined
      if (command === 'drive_touch_device') return []
      throw new Error(`Unexpected command: ${command}`)
    })

    render(<App />)
    fireEvent.change(await screen.findByLabelText('YouTube channel or playlist URL'), {
      target: { value: 'https://www.youtube.com/@lofihiphopmusic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await screen.findByLabelText('Now playing')

    fireEvent.click(screen.getByRole('button', { name: 'Back to your library' }))
    // The chip's visible label reflects live sync status (Sync/Syncing…/
    // Synced/Offline/Sync error) — match any of them rather than one.
    fireEvent.click(screen.getByRole('button', { name: /Sync|Offline/i }))
    fireEvent.click(screen.getByRole('button', { name: /Export file/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not export')
    expect(invoke).toHaveBeenCalledWith('export_library', { contents: expect.any(String) })
  })

  it('pulls in a remote library on sync and shows the device list', async () => {
    vi.stubGlobal('isTauri', true)
    const remoteLibrary = {
      version: 1,
      sources: [{
        url: 'https://www.youtube.com/@RemoteChannel',
        name: 'Remote Channel',
        kind: 'YouTube channel',
        thumbnail: '',
        savedAt: new Date().toISOString(),
        tracks: [{ id: 'r1', title: 'Remote Track', artist: 'Remote Channel', duration: 200 }],
      }],
      mixtapes: [],
      playbackSettings: { shuffle: false, repeatMode: 'off', volume: 70 },
    }
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'google_auth_status') {
        return { configured: true, authenticated: true, user: { name: 'Ada Listener', email: 'ada@example.com' } }
      }
      if (command === 'load_library') return null
      if (command === 'save_library') return undefined
      if (command === 'drive_download_library') return remoteLibrary
      if (command === 'drive_upload_library') return undefined
      if (command === 'drive_touch_device') {
        return [
          { id: 'this-device', name: 'MacBook Pro', lastActiveAt: new Date().toISOString(), isThisDevice: true },
          { id: 'other-device', name: 'Mac mini', lastActiveAt: new Date(0).toISOString(), isThisDevice: false },
        ]
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    render(<App />)
    // Sync runs automatically once the (empty) local library has loaded and
    // the user is authenticated — no manual "Sync now" click needed.
    expect(await screen.findByText('Remote Channel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sync|Offline/i }))
    expect(screen.getByText('MacBook Pro — this device')).toBeInTheDocument()
    expect(screen.getByText('Mac mini')).toBeInTheDocument()
    expect(screen.getByText('Active now')).toBeInTheDocument()
  })

  describe('mixtape deletion', () => {
    async function createMixtapeNamed(name: string) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(twoTrackPlaylist), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      render(<App />)

      fireEvent.change(screen.getByLabelText('YouTube channel or playlist URL'), {
        target: { value: 'https://www.youtube.com/@two-tracks' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Load' }))
      await screen.findByRole('heading', { name: 'Track A' })

      fireEvent.click(screen.getByRole('button', { name: 'Add Track A to a mixtape' }))
      fireEvent.change(screen.getByLabelText('New mixtape name'), { target: { value: name } })
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      fireEvent.click(screen.getByRole('button', { name: 'Back to your library' }))
      expect(await screen.findByText(name)).toBeInTheDocument()
    }

    it('does not delete a mixtape when the confirmation is cancelled', async () => {
      await createMixtapeNamed('Road trip')

      fireEvent.click(screen.getByRole('button', { name: 'Delete mixtape Road trip' }))
      expect(screen.getByRole('alertdialog', { name: 'Delete mixtape' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByText('Road trip')).toBeInTheDocument()
    })

    it('deletes a mixtape once the confirmation is accepted', async () => {
      await createMixtapeNamed('Road trip')

      fireEvent.click(screen.getByRole('button', { name: 'Delete mixtape Road trip' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Road trip')).not.toBeInTheDocument()
    })
  })
})
