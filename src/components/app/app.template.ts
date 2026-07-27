import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { AppComponent } from './app.component'

export function appTemplate(c: AppComponent): TemplateResult {
  const update = c.stagedUpdate()
  const hasPlayer = c.hasPlayer()
  return html`
    ${c.showTitleBar ? html`<td-title-bar></td-title-bar>` : html``}
    ${update && !c.updateDismissed()
      ? html`
          <div class="update-banner" role="status">
            <span>Tapedeck ${update.version} is ready to install.</span>
            <button type="button" class="update-banner__restart" @click=${() => c.restartToUpdate()}>
              Restart to update
            </button>
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
