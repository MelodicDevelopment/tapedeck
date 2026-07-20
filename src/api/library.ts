import { invoke, isTauri } from '@tauri-apps/api/core'
import { emptyLibrary, Library, normalizeLibrary } from '../lib/library'

const STORAGE_KEY = 'tapedeck.library.v1'

/**
 * The desktop app persists the library as a JSON file in the app data
 * directory; the browser build falls back to localStorage.
 */
export async function loadLibrary(): Promise<Library> {
  try {
    if (isTauri()) {
      return normalizeLibrary(await invoke<unknown>('load_library'))
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeLibrary(JSON.parse(stored)) : emptyLibrary()
  } catch {
    return emptyLibrary()
  }
}

export function saveLibrary(library: Library): void {
  try {
    if (isTauri()) {
      invoke('save_library', { library }).catch(() => {})
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
  } catch {
    // Persistence is best-effort; playback must keep working regardless.
  }
}
