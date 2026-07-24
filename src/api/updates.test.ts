import { getVersion } from '@tauri-apps/api/app'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate } from './updates'

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}))

function mockRelease(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  ))
}

describe('checkForUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns update info when a newer release is published', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.1')
    mockRelease({ tag_name: 'v0.2.2', html_url: 'https://github.com/MelodicDevelopment/tapedeck/releases/tag/v0.2.2' })

    expect(await checkForUpdate()).toEqual({
      currentVersion: '0.2.1',
      latestVersion: '0.2.2',
      releaseUrl: 'https://github.com/MelodicDevelopment/tapedeck/releases/tag/v0.2.2',
    })
  })

  it('returns null when already on the latest version', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.2')
    mockRelease({ tag_name: 'v0.2.2', html_url: 'https://example.com' })

    expect(await checkForUpdate()).toBeNull()
  })

  it('returns null when the installed version is ahead of the published release (e.g. a local dev build)', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.3.0')
    mockRelease({ tag_name: 'v0.2.2', html_url: 'https://example.com' })

    expect(await checkForUpdate()).toBeNull()
  })

  it('compares version segments numerically, not lexicographically', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.9')
    mockRelease({ tag_name: 'v0.2.10', html_url: 'https://example.com' })

    const info = await checkForUpdate()
    expect(info?.latestVersion).toBe('0.2.10')
  })

  it('returns null on a network failure', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await checkForUpdate()).toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.1')
    mockRelease({}, 403)

    expect(await checkForUpdate()).toBeNull()
  })

  it('returns null when the response is missing tag_name or html_url', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.1')
    mockRelease({})

    expect(await checkForUpdate()).toBeNull()
  })
})
