import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

/** WebKit before Safari 16.4 (the webview on macOS 12.3–13.2) only exposes
 *  the prefixed Fullscreen API. */
type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: () => void }

let videoElement: () => HTMLElement | null = () => null

/** The YouTube player registers its iframe here (and clears it on destroy)
 *  so the keyboard shortcut can reach into the shadow tree. */
export function setFullscreenVideo(getter: (() => HTMLElement | null) | null): void {
  videoElement = getter ?? (() => null)
}

/** Takes the video fullscreen, or leaves fullscreen if something already is.
 *  Must run synchronously inside a user gesture (a key or click handler). */
export function toggleVideoFullscreen(): void {
  const doc = document as PrefixedDocument
  if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
    if (typeof doc.exitFullscreen === 'function') void doc.exitFullscreen().catch(() => {})
    else doc.webkitExitFullscreen?.()
    return
  }
  const element = videoElement() as PrefixedElement | null
  if (!element) return
  if (typeof element.requestFullscreen === 'function') void element.requestFullscreen().catch(() => {})
  else element.webkitRequestFullscreen?.()
}

/**
 * WebView2 only stretches a fullscreen element across the webview — making
 * the window itself cover the screen is left to the host app. macOS and
 * Linux webviews handle the window themselves, so this is Windows-only.
 */
export function wireWindowFullscreen(): void {
  if (!isTauri() || !navigator.userAgent.includes('Windows')) return
  let entered = false
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement !== null
    if (active === entered) return
    entered = active
    void getCurrentWindow()
      .setFullscreen(active)
      .catch(() => {})
  })
}
