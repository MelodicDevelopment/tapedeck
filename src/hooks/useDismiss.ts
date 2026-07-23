import { useEffect, useRef } from 'react'

/** Closes an anchored popover on an outside click or Escape, while it's open. */
export function useDismiss<T extends HTMLElement>(onClose: () => void, active: boolean) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, onClose])

  return ref
}
