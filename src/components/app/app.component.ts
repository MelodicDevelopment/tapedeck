import { MelodicComponent } from '@melodicdev/core'
import { dismissUpdate } from '../../store/actions'
import {
  confirmDeleteMixtape,
  desktop,
  hasPlayer,
  updateDismissed,
  updateInfo,
  view,
} from '../../store/state'
import { appTemplate } from './app.template'
import { appStyles } from './app.styles'

/**
 * td-app — the root shell: Windows title bar, update banner, and whichever
 * of the player / welcome screens (or both — welcome overlays an active
 * player) applies, plus the delete-mixtape confirm dialog.
 */
@MelodicComponent({
  selector: 'td-app',
  template: appTemplate,
  styles: appStyles,
})
export class AppComponent {
  public view = view
  public hasPlayer = hasPlayer
  public updateInfo = updateInfo
  public updateDismissed = updateDismissed
  public confirmDeleteMixtape = confirmDeleteMixtape

  public readonly showTitleBar: boolean = desktop && navigator.userAgent.includes('Windows')

  public dismissUpdate(): void {
    dismissUpdate()
  }
}
