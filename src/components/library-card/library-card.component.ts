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
  public thumbnail = ''
  /** Raw SVG string for the empty-thumbnail placeholder (cassette or history). */
  public placeholderIcon = ''
  public lastPlayed = false
  public disabled = false
  public removeLabel = ''

  public emit(name: 'td:open' | 'td:remove'): void {
    this.elementRef.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }
}
