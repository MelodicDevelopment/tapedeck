import { invoke, isTauri } from '@tauri-apps/api/core'

/** Opens a web URL in the user's default browser (a new tab outside Tauri). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await invoke('open_external', { url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
