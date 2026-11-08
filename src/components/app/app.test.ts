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

// Side-effect registration of every custom element, like main.ts.
import './index'
import '../brand'
import '../title-bar'
import '../account-summary'
import '../sync-chip'
import '../library-card'
import '../source-switcher'
import '../welcome-screen'
import '../search-results'
import '../player-screen'
import '../playback-bar'
import '../youtube-player'
import '../mixtape-picker'
import '../shortcuts-modal'
import '../confirm-dialog'

import { resetStores } from '../../test/reset-stores'

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

/** Walks the composed tree (light DOM + open shadow roots). */
function deepQueryAll(selector: string, root: ParentNode = document): Element[] {
  const found: Element[] = [...root.querySelectorAll(selector)]
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) found.push(...deepQueryAll(selector, element.shadowRoot))
  }
  return found
}

function deepQuery(selector: string): Element | null {
  return deepQueryAll(selector)[0] ?? null
}

/** Lets Melodic's queueMicrotask render batching and pending promises settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** The last created fake player and the YT API calls it received. */
let ytCalls: string[] = []
let lastFakePlayer: FakePlayer | null = null
function registerFakePlayer(player: FakePlayer): void {
  lastFakePlayer = player
}

const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }

/** When true, the fake player ignores playVideo() the way YouTube sometimes
 *  does right after onReady, leaving the video cued. */
let dropPlayRequests = false

class FakePlayer {
    private _iframe: HTMLIFrameElement
    private _state = YT_STATE.UNSTARTED
    private _onStateChange: ((event: { data: number }) => void) | undefined

    public constructor(
      element: HTMLElement,
      options: {
        events?: {
          onReady?: (event: { target: FakePlayer }) => void
          onStateChange?: (event: { data: number }) => void
        }
      },
    ) {
      registerFakePlayer(this)
      this._iframe = document.createElement('iframe')
      element.replaceWith(this._iframe)
      this._onStateChange = options.events?.onStateChange
      options.events?.onReady?.({ target: this })
    }

    public getPlayerState(): number {
      return this._state
    }

    /** Simulates YouTube reporting a state change. */
    public emitState(state: number): void {
      this._state = state
      this._onStateChange?.({ data: state })
    }

    public destroy(): void {
      this._iframe.remove()
    }

    public getCurrentTime(): number {
      return 0
    }

    public getDuration(): number {
      return 213
    }

    public setVolume(volume: number): void {
      ytCalls.push(`setVolume:${volume}`)
    }

    public playVideo(): void {
      ytCalls.push('playVideo')
      if (!dropPlayRequests) this.emitState(YT_STATE.PLAYING)
    }

    public pauseVideo(): void {
      ytCalls.push('pauseVideo')
      this.emitState(YT_STATE.PAUSED)
    }

    public seekTo(seconds: number): void {
      ytCalls.push(`seekTo:${seconds}`)
    }
}

function installFakeYouTubePlayer(): void {
  ytCalls = []
  lastFakePlayer = null
  dropPlayRequests = false
  Reflect.set(window, 'YT', {
    Player: FakePlayer,
    PlayerState: YT_STATE,
  })
}

async function mountApp(): Promise<void> {
  document.body.appendChild(document.createElement('td-app'))
  await flush()
}

async function loadPlaylist(): Promise<void> {
  const input = deepQuery('.source-form .input') as HTMLInputElement
  input.value = 'https://www.youtube.com/@lofihiphopmusic'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
  const form = deepQuery('form.source-form') as HTMLFormElement
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flush()
  await flush()
}

describe('td-app (DOM)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'YT')
    resetStores()
    installFakeYouTubePlayer()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(apiPlaylist), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  })

  it('renders the welcome card', async () => {
    await mountApp()
    expect(deepQuery('.welcome-card h1')?.textContent).toContain('Play the channels you love')
  })

  it('shows validation feedback for an empty submission', async () => {
    await mountApp()
    const form = deepQuery('form.source-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(deepQuery('.source-form__error')?.textContent).toContain(
      'Paste a YouTube video, channel, or playlist URL first.',
    )
  })

  it('loads a playlist into the player screen with its queue', async () => {
    await mountApp()
    await loadPlaylist()

    expect(deepQuery('td-player-screen')).toBeTruthy()
    expect(deepQuery('.track-details h1')?.textContent).toContain('Fetched song')
    const rows = deepQueryAll('.track-row')
    expect(rows).toHaveLength(2)
    expect(deepQuery('.youtube-player iframe')).toBeTruthy()
  })

  it('shows the unavailable state when an unplayable track is selected', async () => {
    await mountApp()
    await loadPlaylist()

    const rows = deepQueryAll('.track-row') as HTMLButtonElement[]
    rows[1].click()
    await flush()

    expect(deepQuery('.unavailable-state h2')?.textContent).toContain('This video is unavailable')
    expect(deepQuery('.youtube-player iframe')).toBeFalsy()
  })

  it('switches to audio mode without recreating the player iframe', async () => {
    await mountApp()
    await loadPlaylist()
    const iframe = deepQuery('.youtube-player iframe')
    expect(iframe).toBeTruthy()

    const audioButton = deepQueryAll('.mode-toggle__option').find((el) =>
      el.textContent?.includes('Audio'),
    ) as HTMLButtonElement
    audioButton.click()
    await flush()

    expect(deepQuery('.video-frame--hidden')).toBeTruthy()
    expect(deepQuery('.audio-mode')).toBeTruthy()
    // Same iframe node — playback continues uninterrupted.
    expect(deepQuery('.youtube-player iframe')).toBe(iframe)
  })

  it('keeps the player mounted behind the welcome overlay', async () => {
    await mountApp()
    await loadPlaylist()

    const backToLibrary = deepQuery('.player-header__back') as HTMLButtonElement
    backToLibrary.click()
    await flush()

    expect(deepQuery('.welcome-shell--overlay')).toBeTruthy()
    expect(deepQuery('td-player-screen')).toBeTruthy()

    const backToPlayer = deepQuery('.welcome-header__back') as HTMLButtonElement
    backToPlayer.click()
    await flush()
    expect(deepQuery('.welcome-shell--overlay')).toBeFalsy()
  })

  it('keeps library cards mounted when the library re-renders (no image reload blink)', async () => {
    await mountApp()
    await loadPlaylist()
    ;(deepQuery('.player-header__back') as HTMLButtonElement).click()
    await flush()

    const before = deepQueryAll('td-library-card')
    expect(before).toHaveLength(1)

    // A sync landing replaces the library object with an equivalent one and
    // flips the sync status twice; neither should rebuild the card DOM.
    const { library, syncStatus } = await import('../../store/state')
    syncStatus.set('syncing')
    await flush()
    library.set({ ...library(), sources: library().sources.map((source) => ({ ...source })) })
    syncStatus.set('synced')
    await flush()

    const after = deepQueryAll('td-library-card')
    expect(after).toHaveLength(1)
    expect(after[0]).toBe(before[0])
  })

  it('relays play/pause, volume, and seek to the embedded YT player', async () => {
    const { playing, seek, volume } = await import('../../store/player')
    await mountApp()
    await loadPlaylist()
    // Autoplay applied at onReady.
    expect(ytCalls).toContain('playVideo')
    ytCalls = []

    playing.set(false)
    await flush()
    expect(ytCalls).toContain('pauseVideo')

    volume.set(31)
    await flush()
    expect(ytCalls).toContain('setVolume:31')

    playing.set(true)
    await flush()
    seek(42)
    await flush()
    expect(ytCalls).toContain('seekTo:42')
  })

  it('closes the source switcher on an outside click and on Escape', async () => {
    await mountApp()
    await loadPlaylist()

    const trigger = deepQuery('.source-card__trigger') as HTMLButtonElement
    trigger.click()
    await flush()
    expect(deepQuery('.source-switcher')).toBeTruthy()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(deepQuery('.source-switcher')).toBeFalsy()

    trigger.click()
    await flush()
    expect(deepQuery('.source-switcher')).toBeTruthy()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(deepQuery('.source-switcher')).toBeFalsy()
  })

  it('adds a track to a new mixtape through the picker modal', async () => {
    await mountApp()
    await loadPlaylist()

    const addButton = deepQueryAll('.track-item__action')[0] as HTMLButtonElement
    addButton.click()
    await flush()

    expect(deepQuery('td-mixtape-picker .modal, td-mixtape-picker')).toBeTruthy()
    const nameInput = deepQuery('.mixtape-create .input') as HTMLInputElement
    nameInput.value = 'Road trip'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    const createForm = deepQuery('form.mixtape-create') as HTMLFormElement
    createForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()

    // Modal closed; the mixtape now exists in the source switcher dropdown.
    expect(deepQuery('.mixtape-create')).toBeFalsy()
    const trigger = deepQuery('.source-card__trigger') as HTMLButtonElement
    trigger.click()
    await flush()
    const rows = deepQueryAll('.source-switcher__row')
    expect(rows.some((row) => row.textContent?.includes('Road trip'))).toBe(true)
  })

  const searchResponse = {
    results: [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Fetched song (official video)',
        channel: 'Fetched artist',
        channelId: 'UC123',
        duration: 213,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      },
    ],
  }

  function stubSearchFetch(): ReturnType<typeof vi.mocked<typeof fetch>> {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/api/youtube/search') ? searchResponse : apiPlaylist
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    return fetchMock
  }

  it('searches YouTube from the welcome field and plays a result with no player active', async () => {
    const fetchMock = stubSearchFetch()
    await mountApp()

    const input = deepQuery('.source-form .input') as HTMLInputElement
    input.value = 'fetched song'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(deepQuery('.source-form button[type="submit"]')?.textContent?.trim()).toBe('Search')

    ;(deepQuery('form.source-form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flush()
    await flush()

    const searchCall = fetchMock.mock.calls.find(([request]) => String(request).includes('/api/youtube/search'))
    expect(String(searchCall?.[0])).toContain('q=fetched%20song')
    expect(deepQuery('td-search-results')).toBeTruthy()
    const cards = deepQueryAll('.result-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Fetched song (official video)')
    expect(cards[0].textContent).toContain('Fetched artist')

    // Play: becomes an unsaved one-video playlist on the player screen.
    ;(deepQuery('.result-card__art') as HTMLButtonElement).click()
    await flush()
    const { activePlaylist, library } = await import('../../store/state')
    const player = await import('../../store/player')
    expect(activePlaylist()?.tracks.map((track) => track.id)).toEqual(['dQw4w9WgXcQ'])
    expect(player.track()?.artist).toBe('Fetched artist')
    expect(library().sources).toHaveLength(0)
    expect(deepQuery('td-player-screen')).toBeTruthy()
    expect(deepQuery('.welcome-shell--overlay')).toBeFalsy()
    // The stage offers to save the unsaved preview to a mixtape.
    expect(deepQuery('.track-details__add-to-mixtape')).toBeTruthy()
  })

  it('searches from the mixtape add field, previews inline, and adds via the picker', async () => {
    await mountApp()
    await loadPlaylist()
    const { library, searchResults } = await import('../../store/state')
    const actions = await import('../../store/actions')
    const player = await import('../../store/player')
    actions.createMixtape('Road trip', apiPlaylist.tracks[1])
    actions.playMixtape(library().mixtapes[0].id)
    await flush()
    stubSearchFetch()

    const input = deepQuery('.queue-tools .input') as HTMLInputElement
    input.value = 'fetched song'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect((deepQuery('.queue-tools__submit') as HTMLButtonElement).getAttribute('aria-label')).toBe('Search YouTube')
    ;(deepQuery('form.queue-tools') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await flush()
    await flush()

    // Results open as a full screen over the player.
    expect(deepQuery('.welcome-shell--overlay')).toBeTruthy()
    expect(deepQuery('td-search-results')).toBeTruthy()
    expect(deepQueryAll('.result-card')).toHaveLength(1)

    // Clicking a result previews it inline and returns to the player.
    ;(deepQuery('.result-card__title') as HTMLButtonElement).click()
    await flush()
    expect(player.externalVideo()?.id).toBe('dQw4w9WgXcQ')
    expect(player.queueTrackId()).toBe('private-video')
    expect(deepQuery('.welcome-shell--overlay')).toBeFalsy()
    expect(searchResults()).not.toBeNull()

    // Back on the stage: add the preview to a mixtape through the picker.
    const addToMixtape = deepQuery('.track-details__add-to-mixtape') as HTMLButtonElement
    expect(addToMixtape).toBeTruthy()
    addToMixtape.click()
    await flush()
    expect(player.pickerTrack()?.id).toBe('dQw4w9WgXcQ')
    expect(deepQuery('td-mixtape-picker')).toBeTruthy()
    ;(deepQuery('.mixtape-option') as HTMLButtonElement)?.click()
    await flush()
    expect(library().mixtapes[0].tracks.map((track) => track.id)).toEqual(['private-video', 'dQw4w9WgXcQ'])
    player.pickerTrack.set(null)
    await flush()

    // Reopen the results: the card now shows which mixtape holds it, and
    // closing returns to the library grid.
    actions.changeSource()
    await flush()
    expect(deepQuery('.result-card__saved')?.textContent).toContain('Road trip')
    ;(deepQuery('.results__close') as HTMLButtonElement).click()
    await flush()
    expect(deepQuery('td-search-results')).toBeFalsy()
    expect(searchResults()).toBeNull()
  })

  it('keeps source switcher rows mounted across progress checkpoints (no thumbnail flash)', async () => {
    await mountApp()
    await loadPlaylist()
    const trigger = deepQuery('.source-card__trigger') as HTMLButtonElement
    trigger.click()
    await flush()

    const before = deepQueryAll('.source-switcher__row')
    expect(before.length).toBeGreaterThan(1)

    // A resume-position checkpoint rewrites the library (new source objects).
    const { library } = await import('../../store/state')
    library.set({
      ...library(),
      sources: library().sources.map((source) => ({ ...source, lastPositionSecs: 42 })),
    })
    await flush()

    const after = deepQueryAll('.source-switcher__row')
    expect(after).toHaveLength(before.length)
    before.forEach((row, index) => expect(after[index]).toBe(row))
    expect(deepQuery('.source-switcher')).toBeTruthy()
  })

  it('keeps the active mixtape playlist identity across progress checkpoints', async () => {
    await mountApp()
    await loadPlaylist()
    const { activePlaylist, library, playingMixtapeId } = await import('../../store/state')
    const actions = await import('../../store/actions')

    actions.createMixtape('Road trip', apiPlaylist.tracks[0])
    const mixtapeId = library().mixtapes[0].id
    actions.playMixtape(mixtapeId)
    await flush()
    expect(playingMixtapeId()).toBe(mixtapeId)
    const before = activePlaylist()

    library.set({
      ...library(),
      mixtapes: library().mixtapes.map((mixtape) => ({ ...mixtape, lastPositionSecs: 42 })),
    })
    await flush()
    expect(activePlaylist()).toBe(before)

    // A real edit (track list change) does produce a new playlist.
    actions.toggleMixtapeTrack(mixtapeId, apiPlaylist.tracks[1])
    await flush()
    expect(activePlaylist()).not.toBe(before)
  })

  it('re-issues playVideo when YouTube leaves the video cued after onReady', async () => {
    dropPlayRequests = true
    await mountApp()
    await loadPlaylist()

    expect(ytCalls.filter((call) => call === 'playVideo')).toHaveLength(1)
    expect(lastFakePlayer?.getPlayerState()).toBe(YT_STATE.UNSTARTED)

    // YouTube reports the video as merely cued: play again immediately.
    lastFakePlayer?.emitState(YT_STATE.CUED)
    expect(ytCalls.filter((call) => call === 'playVideo')).toHaveLength(2)

    // Still not playing after the grace period: the fallback timer retries.
    await new Promise((resolve) => setTimeout(resolve, 1700))
    expect(ytCalls.filter((call) => call === 'playVideo')).toHaveLength(3)

    // Once it actually plays, renders no longer nudge it.
    dropPlayRequests = false
    lastFakePlayer?.emitState(YT_STATE.PLAYING)
    const { volume } = await import('../../store/player')
    volume.set(40)
    await flush()
    expect(ytCalls.filter((call) => call === 'playVideo')).toHaveLength(3)
  }, 10000)
})
