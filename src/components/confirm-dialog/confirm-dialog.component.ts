import { MelodicComponent } from '@melodicdev/core'
import { cancelDeleteMixtape, confirmDeleteMixtapeNow } from '../../store/actions'
import { confirmDeleteMixtape } from '../../store/state'
import { confirmDialogTemplate } from './confirm-dialog.template'
import { confirmDialogStyles } from './confirm-dialog.styles'

/**
 * td-confirm-dialog — custom in-app confirmation, not `window.confirm()` —
 * WKWebView (the desktop app's engine) doesn't reliably return the user's
 * actual choice from the native dialog, so a delete guarded by
 * `window.confirm()` could silently never fire.
 */
@MelodicComponent({
  selector: 'td-confirm-dialog',
  template: confirmDialogTemplate,
  styles: confirmDialogStyles,
})
export class ConfirmDialogComponent {
  public elementRef!: HTMLElement

  public confirmDeleteMixtape = confirmDeleteMixtape

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.cancel()
  }

  public onCreate(): void {
    window.addEventListener('keydown', this._onKeyDown)
    // The React build autoFocused the destructive action.
    const confirm = this.elementRef.shadowRoot?.querySelector<HTMLButtonElement>('.button--danger')
    confirm?.focus()
  }

  public onDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown)
  }

  public cancel(): void {
    cancelDeleteMixtape()
  }

  public confirm(): void {
    confirmDeleteMixtapeNow()
  }
}
