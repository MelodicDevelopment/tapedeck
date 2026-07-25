import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { ConfirmDialogComponent } from './confirm-dialog.component'

export function confirmDialogTemplate(c: ConfirmDialogComponent): TemplateResult {
  const mixtape = c.confirmDeleteMixtape()
  if (!mixtape) return html``
  return html`
    <div class="modal-backdrop" @click=${() => c.cancel()}>
      <div
        class="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete mixtape"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <div class="confirm-dialog__icon" aria-hidden="true">
          ${unsafeHTML(icon('triangleAlert'))}
        </div>
        <div class="confirm-dialog__copy">
          <strong>Delete mixtape</strong>
          <p>Delete the mixtape "${mixtape.name}"? This cannot be undone.</p>
        </div>
        <div class="confirm-dialog__actions">
          <button type="button" class="button button--ghost" @click=${() => c.cancel()}>
            Cancel
          </button>
          <button type="button" class="button button--danger" @click=${() => c.confirm()}>
            Delete
          </button>
        </div>
      </div>
    </div>
  `
}
