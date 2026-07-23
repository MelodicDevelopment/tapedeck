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

/**
 * On desktop, opens a native save dialog so the user picks where the export
 * goes (resolves false if they cancel). The browser build has no such
 * dialog available, so it falls back to a normal downloaded-file save.
 */
export async function exportLibrary(library: Library): Promise<boolean> {
  const contents = JSON.stringify(library, null, 2)

  if (isTauri()) {
    return invoke<boolean>('export_library', { contents })
  }

  const blob = new Blob([contents], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = 'tapedeck-library.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  return true
}
