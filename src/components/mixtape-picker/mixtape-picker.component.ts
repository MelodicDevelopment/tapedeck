import { MelodicComponent } from '@melodicdev/core'
import type { Track } from '../../data/mockPlaylist'
import { createMixtape, toggleMixtapeTrack } from '../../store/actions'
import { pickerTrack } from '../../store/player'
import { library } from '../../store/state'
import { mixtapePickerTemplate } from './mixtape-picker.template'
import { mixtapePickerStyles } from './mixtape-picker.styles'

/**
 * td-mixtape-picker — "Add to mixtape" modal for a track: toggle it in and
 * out of existing mixtapes or start a new one. Mounted only while a track is
 * picked (the player screen conditionally renders it).
 */
@MelodicComponent({
  selector: 'td-mixtape-picker',
  template: mixtapePickerTemplate,
  styles: mixtapePickerStyles,
})
export class MixtapePickerComponent {
  public elementRef!: HTMLElement

  public pickerTrack = pickerTrack
  public library = library
  public name = ''

  private _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }

  public onCreate(): void {
    window.addEventListener('keydown', this._onKeyDown)
    // First mixtape ever: focus the name field (React's autoFocus).
    if (this.library().mixtapes.length === 0) {
      this.elementRef.shadowRoot?.querySelector<HTMLInputElement>('.mixtape-create .input')?.focus()
    }
  }

  public onDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown)
  }

  public close(): void {
    pickerTrack.set(null)
  }

  public toggle(mixtapeId: string, track: Track): void {
    toggleMixtapeTrack(mixtapeId, track)
  }

  public create(event: Event): void {
    event.preventDefault()
    const track = this.pickerTrack()
    const trimmed = this.name.trim()
    if (!trimmed || !track) return
    createMixtape(trimmed, track)
    this.close()
  }
}
