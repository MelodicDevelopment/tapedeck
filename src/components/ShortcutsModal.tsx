import { X } from 'lucide-react'
import { useEffect } from 'react'

type ShortcutsModalProps = {
  onClose: () => void
}

const ROWS: { label: string; keys: string[] }[] = [
  { label: 'Play / pause', keys: ['Space'] },
  { label: 'Next track', keys: ['→'] },
  { label: 'Previous track', keys: ['←'] },
  { label: 'Volume up', keys: ['↑'] },
  { label: 'Volume down', keys: ['↓'] },
  { label: 'Toggle shuffle', keys: ['⇧', 'S'] },
  { label: 'Shortcuts', keys: ['?'] },
  { label: 'Close', keys: ['Esc'] },
]

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shortcuts-modal__header">
          <strong>Keyboard shortcuts</strong>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </header>
        <ul className="shortcuts-modal__list">
          {ROWS.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <span className="shortcuts-modal__keys">
                {row.keys.map((key) => <kbd key={key}>{key}</kbd>)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
