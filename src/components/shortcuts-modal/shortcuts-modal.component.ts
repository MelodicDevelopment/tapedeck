import { MelodicComponent } from '@melodicdev/core'
import { shortcutsOpen } from '../../store/player'
import { shortcutsModalTemplate } from './shortcuts-modal.template'
import { shortcutsModalStyles } from './shortcuts-modal.styles'

/**
 * td-shortcuts-modal — the keyboard shortcuts reference. Mounted only while
 * open (the player screen conditionally renders it).
 */
@MelodicComponent({
  selector: 'td-shortcuts-modal',
  template: shortcutsModalTemplate,
  styles: shortcutsModalStyles,
})
export class ShortcutsModalComponent {
  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }

  public onCreate(): void {
    window.addEventListener('keydown', this._onKeyDown)
  }

  public onDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown)
  }

  public close(): void {
    shortcutsOpen.set(false)
  }
}
