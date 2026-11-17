import { MelodicComponent } from '@melodicdev/core'
import { libraryCardTemplate } from './library-card.template'
import { libraryCardStyles } from './library-card.styles'

/**
 * td-library-card — one tile in the welcome screen's library grid. Fed via
 * property bindings; the host uses display:contents so the inner <li>
 * participates in the parent grid exactly like the React markup did.
 *
 * @fires td:open - The tile art was clicked.
 * @fires td:remove - The remove button was clicked.
 * @fires td:rename - A new name was entered (detail: the name). Only when `renamable`.
 */
@MelodicComponent({
  selector: 'td-library-card',
  template: libraryCardTemplate,
  styles: libraryCardStyles,
})
export class LibraryCardComponent {
  public elementRef!: HTMLElement

  public name = ''
  public meta = ''
  /** Short kind label shown as a tag on the art (Channel / Playlist / Video / Mixtape). */
  public kind = ''
  public thumbnail = ''
  /** Raw SVG string for the empty-thumbnail placeholder (cassette or history). */
  public placeholderIcon = ''
  public lastPlayed = false
  public disabled = false
  public removeLabel = ''
  /** Shows a rename button and lets the name be edited in place. */
  public renamable = false

  public editing = false
  public draftName = ''
  private _focusPending = false

  /** Focus the rename field once it has actually rendered. */
  public onRender(): void {
    if (!this._focusPending) return
    const input = this.elementRef.shadowRoot?.querySelector<HTMLInputElement>('.library-grid__name-input')
    if (!input) return
    this._focusPending = false
    input.focus()
    input.select()
  }

  public emit(name: 'td:open' | 'td:remove'): void {
    this.elementRef.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }

  public startRename(): void {
    this.draftName = this.name
    this._focusPending = true
    this.editing = true
  }

  /** Saves on Enter or blur. A blank or unchanged name is dropped. */
  public commitRename(): void {
    if (!this.editing) return
    this.editing = false
    const name = this.draftName.trim()
    if (!name || name === this.name) return
    this.elementRef.dispatchEvent(new CustomEvent('td:rename', { detail: name, bubbles: true, composed: true }))
  }

  public onRenameKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.editing = false
    }
  }
}
