import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { resetStores } from '../test/reset-stores'
import * as actions from './actions'
import * as player from './player'
import { library } from './state'

const playlist = {
  name: 'Fetched playlist',
  kind: 'YouTube playlist',
  description: '',
  thumbnail: '',
  sourceUrl: 'https://www.youtube.com/playlist?list=PL123',
  tracks: [
    { id: 'trackA', title: 'Track A', artist: 'Artist A', duration: 200 },
    { id: 'trackB', title: 'Track B', artist: 'Artist B', duration: 200 },
  ],
}

// Timer-driven cross-cutting effects (wired once by bootstrap, like the app).
describe('store effects', () => {
  beforeAll(async () => {
    vi.useFakeTimers()
    // A fresh Response per call — a Response body can only be read once.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(playlist), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    await actions.bootstrap()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    window.localStorage.clear()
    resetStores()
  })

  it('persists playback settings to the library, debounced', async () => {
    await actions.handleLoad(playlist.sourceUrl)
    player.volume.set(35)
    player.shuffle.set(true)
    await vi.advanceTimersByTimeAsync(399)
    expect(library().playbackSettings.volume).toBe(70)

    await vi.advanceTimersByTimeAsync(2)
    expect(library().playbackSettings.volume).toBe(35)
    expect(library().playbackSettings.shuffle).toBe(true)
  })

  it('checkpoints the resume position every 15 seconds', async () => {
    await actions.handleLoad(playlist.sourceUrl)
    player.reportProgress(72, 200)

    await vi.advanceTimersByTimeAsync(15100)

    const source = library().sources.find((entry) => entry.url === playlist.sourceUrl)
    expect(source?.lastTrackId).toBe('trackA')
    expect(source?.lastPositionSecs).toBe(72)
  })
})
