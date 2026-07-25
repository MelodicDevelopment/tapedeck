import { beforeAll, describe, expect, it, vi } from 'vitest'

// state.ts computes `desktop` at import time — flip the flag before any
// store module loads (the mocked isTauri reads it lazily, imports are hoisted
// so vi.hoisted is the only reliable ordering).
vi.hoisted(() => {
  Reflect.set(globalThis, 'isTauri', true)
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => Boolean(Reflect.get(globalThis, 'isTauri')),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.2.1'),
}))

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import * as actions from './actions'
import * as player from './player'
import {
  authStatus,
  desktop,
  error,
  hasPlayer,
  library,
  syncDevices,
  syncStatus,
  updateInfo,
} from './state'

const remoteLibrary = {
  version: 1,
  sources: [
    {
      url: 'https://www.youtube.com/@RemoteChannel',
      name: 'Remote Channel',
      kind: 'YouTube channel',
      thumbnail: '',
      savedAt: new Date().toISOString(),
      tracks: [{ id: 'r1', title: 'Remote Track', artist: 'Remote Channel', duration: 200 }],
    },
  ],
  mixtapes: [],
  playbackSettings: { shuffle: false, repeatMode: 'off', volume: 70 },
}

// These tests intentionally share one bootstrap() (effects and listeners are
// wired once per app lifetime) and run in order, like the app itself.
describe('store actions (desktop build)', () => {
  beforeAll(async () => {
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
      if (command === 'resolve_youtube_source') return remoteLibrary.sources[0]
      if (command === 'resolve_video') {
        return { id: 'related-123', title: 'Related video', artist: 'Some Other Channel', duration: 180 }
      }
      throw new Error(`Unexpected command: ${String(command)}`)
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            tag_name: 'v0.2.2',
            html_url: 'https://github.com/MelodicDevelopment/tapedeck/releases/tag/v0.2.2',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    await actions.bootstrap()
  })

  it('runs as the desktop build', () => {
    expect(desktop).toBe(true)
  })

  it('checks auth and syncs the remote library automatically on launch', async () => {
    await vi.waitFor(() => {
      expect(authStatus()?.authenticated).toBe(true)
      expect(library().sources.map((entry) => entry.name)).toContain('Remote Channel')
      expect(syncStatus()).toBe('synced')
    })
    expect(syncDevices().map((device) => device.name)).toEqual(['MacBook Pro', 'Mac mini'])
  })

  it('surfaces a newer published release as update info', async () => {
    await vi.waitFor(() => {
      expect(updateInfo()?.latestVersion).toBe('0.2.2')
      expect(updateInfo()?.currentVersion).toBe('0.2.1')
    })
  })

  it('plays a related-video click inline via the Tauri event', async () => {
    actions.openSavedSource('https://www.youtube.com/@RemoteChannel')
    expect(hasPlayer()).toBe(true)

    const registration = vi
      .mocked(listen)
      .mock.calls.find(([eventName]) => eventName === 'tapedeck://play-external-video')
    expect(registration).toBeTruthy()
    const handler = registration?.[1] as (event: { payload: string }) => void
    handler({ payload: 'related-123' })

    await vi.waitFor(() => {
      expect(player.track()?.id).toBe('related-123')
    })
    expect(player.queueTrackId()).toBe('r1')

    player.returnToQueue()
    expect(player.track()?.id).toBe('r1')
  })

  it('drives playback from the keyboard shortcuts wired at bootstrap', () => {
    actions.openSavedSource('https://www.youtube.com/@RemoteChannel')
    expect(hasPlayer()).toBe(true)

    const wasPlaying = player.playing()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(player.playing()).toBe(!wasPlaying)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(player.playing()).toBe(wasPlaying)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(player.volume()).toBe(75)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(player.volume()).toBe(70)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', shiftKey: true }))
    expect(player.shuffle()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', shiftKey: true }))
    expect(player.shuffle()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
    expect(player.shortcutsOpen()).toBe(true)
    player.shortcutsOpen.set(false)
  })

  it('blocks URL loading while signed out', async () => {
    authStatus.set({ configured: true, authenticated: false })
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    expect(error()).toBe('Sign in with Google before loading a YouTube channel or playlist.')
    authStatus.set({ configured: true, authenticated: true, user: { name: 'Ada Listener', email: 'ada@example.com' } })
  })

  it('signs in on demand and stores the returned account', async () => {
    authStatus.set({ configured: true, authenticated: false })
    vi.mocked(invoke).mockImplementationOnce(async (command) => {
      expect(command).toBe('sign_in_with_google')
      return { configured: true, authenticated: true, user: { name: 'Ada Listener', email: 'ada@example.com' } }
    })
    await actions.signIn()
    expect(authStatus()?.authenticated).toBe(true)
    expect(authStatus()?.user?.name).toBe('Ada Listener')
  })
})
