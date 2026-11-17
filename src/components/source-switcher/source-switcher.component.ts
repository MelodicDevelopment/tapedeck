import { MelodicComponent } from '@melodicdev/core'
import { renameMixtape } from '../../store/actions'
import { activePlaylist, library, playingMixtapeId } from '../../store/state'
import { createDismiss } from '../../ui/dismiss'
import { sourceSwitcherTemplate } from './source-switcher.template'
import { sourceSwitcherStyles } from './source-switcher.styles'

/**
 * td-source-switcher — the "now playing source" card at the top of the queue
 * panel, with a dropdown listing mixtapes and saved sources. While a mixtape
 * is playing its name can be edited in place.
 */
@MelodicComponent({
  selector: 'td-source-switcher',
  template: sourceSwitcherTemplate,
  styles: sourceSwitcherStyles,
})
export class SourceSwitcherComponent {
  public elementRef!: HTMLElement

  public activePlaylist = activePlaylist
  public library = library
  public playingMixtapeId = playingMixtapeId
  public open = false

  /** Inline rename of the playing mixtape. */
  public editing = false
  public draftName = ''
  private _focusPending = false

  private _disposeDismiss: (() => void) | undefined

  public onCreate(): void {
    this._disposeDismiss = createDismiss(
      this.elementRef,
      () => this.open,
      () => (this.open = false),
    )
  }

  public onDestroy(): void {
    this._disposeDismiss?.()
  }

  /** Focus the rename field once it has actually rendered. */
  public onRender(): void {
    if (!this._focusPending) return
    const input = this.elementRef.shadowRoot?.querySelector<HTMLInputElement>('.source-card__name-input')
    if (!input) return
    this._focusPending = false
    input.focus()
    input.select()
  }

  public choose(action: () => void): void {
    this.open = false
    action()
  }

  public startRename(): void {
    if (!this.playingMixtapeId()) return
    this.open = false
    this.draftName = this.activePlaylist()?.name ?? ''
    this._focusPending = true
    this.editing = true
  }

  /** Saves on Enter or blur. A blank name keeps the old one. */
  public commitRename(): void {
    if (!this.editing) return
    this.editing = false
    const mixtapeId = this.playingMixtapeId()
    if (mixtapeId) renameMixtape(mixtapeId, this.draftName)
  }

  public cancelRename(): void {
    this.editing = false
  }

  public onRenameKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.cancelRename()
    }
  }
}
