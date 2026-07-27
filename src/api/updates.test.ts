import { beforeEach, describe, expect, it, vi } from 'vitest'

const check = vi.fn()
const relaunch = vi.fn()

vi.mock('@tauri-apps/plugin-updater', () => ({ check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch }))

/** A fresh copy of the module per test — staging state lives at module level. */
async function loadUpdates() {
  return await import('./updates')
}

function mockUpdate(overrides: Partial<Record<'download' | 'install', unknown>> = {}) {
  return {
    currentVersion: '0.3.0',
    version: '0.4.0',
    download: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('stageUpdate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('downloads an available update and reports the staged versions', async () => {
    const update = mockUpdate()
    check.mockResolvedValue(update)
    const { stageUpdate } = await loadUpdates()

    expect(await stageUpdate()).toEqual({ currentVersion: '0.3.0', version: '0.4.0' })
    expect(update.download).toHaveBeenCalledOnce()
  })

  it('returns null when already on the latest version', async () => {
    check.mockResolvedValue(null)
    const { stageUpdate } = await loadUpdates()

    expect(await stageUpdate()).toBeNull()
  })

  it('returns null when the manifest check fails (e.g. offline)', async () => {
    check.mockRejectedValue(new Error('offline'))
    const { stageUpdate } = await loadUpdates()

    expect(await stageUpdate()).toBeNull()
  })

  it('returns null and stages nothing when the download fails', async () => {
    const update = mockUpdate({ download: vi.fn().mockRejectedValue(new Error('disk full')) })
    check.mockResolvedValue(update)
    const { stageUpdate, restartToUpdate } = await loadUpdates()

    expect(await stageUpdate()).toBeNull()

    await restartToUpdate()
    expect(update.install).not.toHaveBeenCalled()
    expect(relaunch).not.toHaveBeenCalled()
  })
})

describe('restartToUpdate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('installs the staged update and relaunches', async () => {
    const update = mockUpdate()
    check.mockResolvedValue(update)
    const { stageUpdate, restartToUpdate } = await loadUpdates()
    await stageUpdate()

    await restartToUpdate()
    expect(update.install).toHaveBeenCalledOnce()
    expect(relaunch).toHaveBeenCalledOnce()
  })

  it('does nothing when no update has been staged', async () => {
    const { restartToUpdate } = await loadUpdates()

    await restartToUpdate()
    expect(relaunch).not.toHaveBeenCalled()
  })
})
