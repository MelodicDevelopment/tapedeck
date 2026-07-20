import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type MediaControlAction =
  | 'play'
  | 'pause'
  | 'toggle'
  | 'next'
  | 'previous'
  | 'seek'
  | 'seekBy'
  | 'setVolume'

export type MediaControlEvent = {
  action: MediaControlAction
  /** Seconds for seek/seekBy (seekBy may be negative), 0–1 for setVolume. */
  value?: number | null
}

/**
 * Subscribe to hardware media key presses forwarded by the desktop shell
 * (play/pause, next, previous, seek). Returns an unsubscribe function.
 */
export function onMediaControl(handler: (event: MediaControlEvent) => void): () => void {
  if (!isTauri()) return () => {}
  const unlisten = listen<MediaControlEvent>('media-control', (event) => handler(event.payload))
  return () => {
    unlisten.then((dispose) => dispose()).catch(() => {})
  }
}

type MediaMetadata = {
  title: string
  artist: string
  coverUrl?: string
  durationSecs?: number
}

/** Publish track info to the OS now-playing surface (Control Center on macOS). */
export function updateMediaMetadata(metadata: MediaMetadata) {
  if (!isTauri()) return
  invoke('media_set_metadata', {
    title: metadata.title,
    artist: metadata.artist,
    coverUrl: metadata.coverUrl ?? null,
    durationSecs: metadata.durationSecs ?? null,
  }).catch(() => {})
}

/** Publish play/pause state and position so media keys route to Tapedeck. */
export function updateMediaPlayback(playing: boolean, positionSecs?: number) {
  if (!isTauri()) return
  invoke('media_set_playback', {
    playing,
    positionSecs: positionSecs ?? null,
  }).catch(() => {})
}
