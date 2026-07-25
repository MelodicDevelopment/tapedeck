/** Closes an anchored popover on an outside click or Escape (the React
 *  build's useDismiss hook). Register in onCreate, dispose in onDestroy.
 *  Uses composedPath so clicks inside the host's shadow tree count as inside. */
export function createDismiss(
  host: HTMLElement,
  isOpen: () => boolean,
  onClose: () => void,
): () => void {
  function handlePointerDown(event: MouseEvent): void {
    if (isOpen() && !event.composedPath().includes(host)) onClose()
  }
  function handleKeyDown(event: KeyboardEvent): void {
    if (isOpen() && event.key === 'Escape') onClose()
  }

  document.addEventListener('mousedown', handlePointerDown)
  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('mousedown', handlePointerDown)
    document.removeEventListener('keydown', handleKeyDown)
  }
}
