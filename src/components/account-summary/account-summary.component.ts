import { MelodicComponent } from '@melodicdev/core'
import { authAction, authStatus } from '../../store/state'
import { accountSummaryTemplate } from './account-summary.template'
import { accountSummaryStyles } from './account-summary.styles'

/**
 * td-account-summary — the signed-in Google account chip with avatar,
 * name/email, and a sign-out button. Renders nothing while signed out.
 */
@MelodicComponent({
  selector: 'td-account-summary',
  template: accountSummaryTemplate,
  styles: accountSummaryStyles,
})
export class AccountSummaryComponent {
  public authStatus = authStatus
  public authAction = authAction
  public avatarFailed = false

  private _lastPicture: string | undefined

  /** A new avatar URL gets a fresh chance to load (React's useEffect [picture]). */
  public onRender(): void {
    const picture = this.authStatus()?.user?.picture
    if (picture === this._lastPicture) return
    this._lastPicture = picture
    if (this.avatarFailed) this.avatarFailed = false
  }
}
