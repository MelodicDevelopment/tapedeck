import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { AppComponent } from './app.component'

export function appTemplate(c: AppComponent): TemplateResult {
  const update = c.updateInfo()
  const hasPlayer = c.hasPlayer()
  return html`
    ${c.showTitleBar ? html`<td-title-bar></td-title-bar>` : html``}
    ${update && !c.updateDismissed()
      ? html`
          <div class="update-banner" role="status">
            <span>
              Tapedeck ${update.latestVersion} is available (you have ${update.currentVersion}).
            </span>
            <a href=${update.releaseUrl} target="_blank" rel="noreferrer" class="update-banner__link">
              Get the update
            </a>
            <button
              type="button"
              class="update-banner__dismiss"
              @click=${() => c.dismissUpdate()}
              aria-label="Dismiss update notice"
            >
              ${unsafeHTML(icon('x'))}
            </button>
          </div>
        `
      : html``}
    ${hasPlayer ? html`<td-player-screen></td-player-screen>` : html``}
    ${!hasPlayer || c.view() !== 'loaded' ? html`<td-welcome-screen></td-welcome-screen>` : html``}
    ${c.confirmDeleteMixtape() ? html`<td-confirm-dialog></td-confirm-dialog>` : html``}
  `
}
