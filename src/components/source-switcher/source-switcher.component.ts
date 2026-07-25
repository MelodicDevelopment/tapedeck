import { MelodicComponent } from '@melodicdev/core'
import { activePlaylist, library, playingMixtapeId } from '../../store/state'
import { createDismiss } from '../../ui/dismiss'
import { sourceSwitcherTemplate } from './source-switcher.template'
import { sourceSwitcherStyles } from './source-switcher.styles'

/**
 * td-source-switcher — the "now playing source" card at the top of the queue
 * panel, with a dropdown listing mixtapes and saved sources.
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

  public choose(action: () => void): void {
    this.open = false
    action()
  }
}
