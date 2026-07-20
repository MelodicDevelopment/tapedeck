import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => Boolean(Reflect.get(globalThis, 'isTauri')),
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

describe('Tapedeck', () => {
  beforeEach(() => {
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

  it('offers the mock catalogue as an explicit demo', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview the demo playlist' }))
    expect(screen.getByRole('heading', { name: 'Never Gonna Give You Up' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the player mounted when selecting another track', () => {
    installYouTubePlayerThatReplacesItsMountNode()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview the demo playlist' }))

    fireEvent.click(screen.getByRole('button', { name: 'Next track' }))

    expect(screen.getByRole('heading', { name: 'Take On Me' })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Preview the demo playlist' })).toBeEnabled()
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
})
