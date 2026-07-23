import { invoke } from '@tauri-apps/api/core'
import { normalizeCommandError } from './auth'
import { Library, mergeLibrary, normalizeLibrary } from '../lib/library'

export type SyncedDevice = {
  id: string
  name: string
  lastActiveAt: string
  isThisDevice: boolean
}

export type SyncResult = {
  library: Library
  devices: SyncedDevice[]
}

/**
 * One sync round-trip: download whatever's on Drive (if anything), merge it
 * with the local library (`mergeLibrary` already implements last-write-wins
 * per source/mixtape), push the merged result back up, then mark this
 * device active. Desktop-only — Drive access goes through the Rust
 * `sync` module, there's no browser-build equivalent.
 */
export async function syncLibrary(local: Library): Promise<SyncResult> {
  try {
    const remote = await invoke<unknown>('drive_download_library')
    const merged = remote ? mergeLibrary(local, normalizeLibrary(remote)) : local
    await invoke('drive_upload_library', { library: merged })
    const devices = await invoke<SyncedDevice[]>('drive_touch_device', { now: new Date().toISOString() })
    return { library: merged, devices }
  } catch (error) {
    throw normalizeCommandError(error, 'Tapedeck could not sync your library.')
  }
}
