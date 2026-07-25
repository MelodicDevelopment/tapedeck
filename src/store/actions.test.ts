import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import {
  activePlaylist,
  confirmDeleteMixtape,
  error,
  hasPlayer,
  library,
  playingMixtapeId,
  view,
} from './state'

const apiPlaylist = {
  name: 'Fetched playlist',
  kind: 'YouTube playlist',
  description: 'From the API',
  thumbnail: 'https://example.com/thumb.jpg',
  sourceUrl: 'https://www.youtube.com/playlist?list=PL123',
  tracks: [
    { id: 'dQw4w9WgXcQ', title: 'Fetched song', artist: 'Fetched artist', duration: 213 },
    {
      id: 'private-video',
      title: 'Private song',
      artist: 'Unavailable on YouTube',
      duration: 0,
      unavailable: true,
    },
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

function stubResolve(playlist: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(playlist), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

describe('store actions (browser build)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
    resetStores()
    stubResolve(apiPlaylist)
  })

  it('shows validation feedback for an empty submission', async () => {
    await actions.handleLoad()
    expect(error()).toBe('Paste a YouTube channel or playlist URL first.')
    expect(view()).toBe('welcome')
  })

  it('loads a resolved listening queue and saves the source', async () => {
    actions.setUrl('https://www.youtube.com/@lofihiphopmusic')
    const load = actions.handleLoad()
    expect(view()).toBe('loading')
    await load

    expect(view()).toBe('loaded')
    expect(hasPlayer()).toBe(true)
    expect(activePlaylist()?.name).toBe('Fetched playlist')
    expect(player.playing()).toBe(true)
    expect(player.currentIndex()).toBe(0)
    expect(library().sources).toHaveLength(1)
    expect(library().sources[0].tracks).toHaveLength(2)
  })

  it('surfaces server errors in the welcome state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'API_NOT_CONFIGURED', message: 'The YouTube Data API is not configured yet.' },
          }),
          { status: 503, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    expect(error()).toContain('not configured')
    expect(view()).toBe('welcome')
  })

  it('marks a selected unavailable track and does not play it', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    player.selectTrack(1)
    expect(player.unavailable()).toBe(true)
    expect(player.playing()).toBe(false)
  })

  it('skips unavailable tracks when advancing the queue', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    // Track 1 is unavailable, so next wraps back to track 0.
    player.moveTrack(1)
    expect(player.currentIndex()).toBe(0)
  })

  it('repeat-one seeks back to the start when a track ends', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    player.repeatMode.set('one')
    player.reportProgress(120, 213)
    player.handleEnded()
    expect(player.elapsed()).toBe(0)
    expect(player.seekTo()?.seconds).toBe(0)
    expect(player.currentIndex()).toBe(0)
  })

  it('stops at the end of the queue when repeat is off', async () => {
    stubResolve(twoTrackPlaylist)
    await actions.handleLoad('https://www.youtube.com/@two-tracks')
    player.selectTrack(1)
    player.handleEnded()
    expect(player.playing()).toBe(false)
    expect(player.currentIndex()).toBe(1)
  })

  it('opens a saved source instantly from cache, resuming at the saved track and position', () => {
    library.set({
      version: 1,
      sources: [
        {
          url: twoTrackPlaylist.sourceUrl,
          name: twoTrackPlaylist.name,
          kind: twoTrackPlaylist.kind,
          thumbnail: '',
          savedAt: new Date(0).toISOString(),
          tracks: twoTrackPlaylist.tracks,
          lastTrackId: 'trackB',
          lastPositionSecs: 42,
          lastPlayedAt: new Date(0).toISOString(),
        },
      ],
      mixtapes: [],
      playbackSettings: { shuffle: false, repeatMode: 'off', volume: 70 },
      deletedSourceUrls: [],
      deletedMixtapeIds: [],
    })

    actions.openSavedSource(twoTrackPlaylist.sourceUrl)

    // Instant: no loading state, playing from the cached track list.
    expect(view()).toBe('loaded')
    expect(activePlaylist()?.name).toBe('Two Track Playlist')
    expect(player.currentIndex()).toBe(1)
    expect(player.elapsed()).toBe(42)
    expect(player.playing()).toBe(true)
  })

  it('plays an external video inline and returns to the queue where it left off', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    player.reportProgress(90, 213)

    player.saveQueueStateOnce()
    player.showExternalVideo({
      id: 'related-123',
      title: 'Related video',
      artist: 'Some Other Channel',
      duration: 180,
    })
    expect(player.track()?.id).toBe('related-123')
    expect(player.elapsed()).toBe(0)
    // The real queue position is untouched by the override.
    expect(player.queueTrackId()).toBe('dQw4w9WgXcQ')

    player.returnToQueue()
    expect(player.track()?.id).toBe('dQw4w9WgXcQ')
    expect(player.elapsed()).toBe(90)
    expect(player.playing()).toBe(true)
  })

  it('clears the external video override when the user picks a queue track', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    player.saveQueueStateOnce()
    player.showExternalVideo({ id: 'related-123', title: 'Related video', artist: 'X', duration: 180 })

    player.selectTrack(1)
    expect(player.externalVideo()).toBeNull()
    expect(player.track()?.id).toBe('private-video')
  })

  it('creates a mixtape, plays it, and follows edits mid-playback', async () => {
    stubResolve(twoTrackPlaylist)
    await actions.handleLoad('https://www.youtube.com/@two-tracks')
    const [trackA, trackB] = twoTrackPlaylist.tracks

    actions.createMixtape('Road trip', trackA)
    expect(library().mixtapes).toHaveLength(1)
    const mixtapeId = library().mixtapes[0].id

    actions.toggleMixtapeTrack(mixtapeId, trackB)
    actions.playMixtape(mixtapeId)
    expect(playingMixtapeId()).toBe(mixtapeId)
    expect(activePlaylist()?.kind).toBe('Mixtape')
    expect(activePlaylist()?.tracks).toHaveLength(2)

    // Removing the current (first) track keeps playback on a valid index.
    player.selectTrack(1)
    actions.toggleMixtapeTrack(mixtapeId, trackB)
    expect(activePlaylist()?.tracks).toHaveLength(1)
    expect(player.currentIndex()).toBe(0)

    // Removing the last track stops mixtape playback entirely.
    actions.toggleMixtapeTrack(mixtapeId, trackA)
    expect(playingMixtapeId()).toBeNull()
    expect(view()).toBe('welcome')
  })

  it('requires confirmation before deleting a mixtape', async () => {
    stubResolve(twoTrackPlaylist)
    await actions.handleLoad('https://www.youtube.com/@two-tracks')
    actions.createMixtape('Road trip', twoTrackPlaylist.tracks[0])
    const mixtapeId = library().mixtapes[0].id

    actions.requestDeleteMixtape(mixtapeId)
    expect(confirmDeleteMixtape()?.name).toBe('Road trip')

    actions.cancelDeleteMixtape()
    expect(confirmDeleteMixtape()).toBeNull()
    expect(library().mixtapes).toHaveLength(1)

    actions.requestDeleteMixtape(mixtapeId)
    actions.confirmDeleteMixtapeNow()
    expect(library().mixtapes).toHaveLength(0)
  })

  it('reorders mixtape tracks and keeps following the current track', async () => {
    stubResolve(twoTrackPlaylist)
    await actions.handleLoad('https://www.youtube.com/@two-tracks')
    const [trackA, trackB] = twoTrackPlaylist.tracks
    actions.createMixtape('Road trip', trackA)
    const mixtapeId = library().mixtapes[0].id
    actions.toggleMixtapeTrack(mixtapeId, trackB)
    actions.playMixtape(mixtapeId)
    expect(player.queueTrackId()).toBe('trackA')

    actions.reorderMixtapeTrack(mixtapeId, 0, 1)
    // trackA moved to index 1; playback follows it.
    expect(player.currentIndex()).toBe(1)
    expect(player.queueTrackId()).toBe('trackA')
  })

  it('flushes the outgoing source\'s resume position when switching sources', async () => {
    // Regression: the flush must target the OLD source, before the new
    // source's signals are set (React flushed on unmount with old refs).
    // Loaded by its own sourceUrl so the library entry and the progress
    // target share a key, as the real resolver guarantees.
    await actions.handleLoad(apiPlaylist.sourceUrl)
    player.reportProgress(50, 213)

    library.set({
      ...library(),
      sources: [
        ...library().sources,
        {
          url: twoTrackPlaylist.sourceUrl,
          name: twoTrackPlaylist.name,
          kind: twoTrackPlaylist.kind,
          thumbnail: '',
          savedAt: new Date(0).toISOString(),
          tracks: twoTrackPlaylist.tracks,
        },
      ],
    })
    actions.openSavedSource(twoTrackPlaylist.sourceUrl)

    const first = library().sources.find((entry) => entry.url === apiPlaylist.sourceUrl)
    expect(first?.lastTrackId).toBe('dQw4w9WgXcQ')
    expect(first?.lastPositionSecs).toBe(50)
    const second = library().sources.find((entry) => entry.url === twoTrackPlaylist.sourceUrl)
    expect(second?.lastPositionSecs).toBeUndefined()
  })

  it('silently refreshes an opened saved source in the background and follows the current track', async () => {
    const reordered = {
      ...twoTrackPlaylist,
      tracks: [twoTrackPlaylist.tracks[1], twoTrackPlaylist.tracks[0]],
    }
    stubResolve(reordered)
    library.set({
      ...library(),
      sources: [
        {
          url: twoTrackPlaylist.sourceUrl,
          name: twoTrackPlaylist.name,
          kind: twoTrackPlaylist.kind,
          thumbnail: '',
          savedAt: new Date(0).toISOString(),
          tracks: twoTrackPlaylist.tracks,
        },
      ],
    })

    actions.openSavedSource(twoTrackPlaylist.sourceUrl)
    expect(player.queueTrackId()).toBe('trackA')

    // Let the background re-resolve land and swap in the fresh order.
    await vi.waitFor(() => {
      expect(activePlaylist()?.tracks[0].id).toBe('trackB')
    })
    // Still on the same track, now at its new position.
    expect(player.queueTrackId()).toBe('trackA')
    expect(player.currentIndex()).toBe(1)
    // The cache was updated too.
    expect(library().sources[0].tracks[0].id).toBe('trackB')
  })

  it('clamps media-control seek and maps setVolume from 0-1 to 0-100', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    player.duration.set(213)

    player.handleMediaControl({ action: 'seek', value: 9999 })
    expect(player.elapsed()).toBe(213)

    player.handleMediaControl({ action: 'seekBy', value: -9999 })
    expect(player.elapsed()).toBe(0)

    player.handleMediaControl({ action: 'setVolume', value: 0.5 })
    expect(player.volume()).toBe(50)
    player.handleMediaControl({ action: 'setVolume', value: 2 })
    expect(player.volume()).toBe(100)

    player.handleMediaControl({ action: 'pause' })
    expect(player.playing()).toBe(false)
    player.handleMediaControl({ action: 'toggle' })
    expect(player.playing()).toBe(true)
  })

  it('keeps the player behind the welcome overlay and returns to it', async () => {
    await actions.handleLoad('https://www.youtube.com/@lofihiphopmusic')
    actions.changeSource()
    expect(view()).toBe('welcome')
    expect(hasPlayer()).toBe(true)

    actions.closeOverlay()
    expect(view()).toBe('loaded')
  })
})
