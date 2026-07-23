import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Custom in-app confirmation, not `window.confirm()` — WKWebView (the
 * desktop app's engine) doesn't reliably return the user's actual choice
 * from the native dialog, so a delete guarded by `window.confirm()` could
 * silently never fire.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog__icon" aria-hidden="true">
          <TriangleAlert />
        </div>
        <div className="confirm-dialog__copy">
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
        <div className="confirm-dialog__actions">
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button button--danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
