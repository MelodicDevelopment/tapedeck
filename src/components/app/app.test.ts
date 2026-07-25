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

function installFakeYouTubePlayer(): void {
  class FakePlayer {
    private _iframe: HTMLIFrameElement

    public constructor(element: HTMLElement, options: { events?: { onReady?: (event: { target: FakePlayer }) => void } }) {
      this._iframe = document.createElement('iframe')
      element.replaceWith(this._iframe)
      options.events?.onReady?.({ target: this })
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

    public setVolume(): void {}
    public playVideo(): void {}
    public pauseVideo(): void {}
    public seekTo(): void {}
  }

  Reflect.set(window, 'YT', {
    Player: FakePlayer,
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
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
      'Paste a YouTube channel or playlist URL first.',
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
})
