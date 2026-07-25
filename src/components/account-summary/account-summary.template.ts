import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { signOut } from '../../store/actions'
import { icon } from '../../ui/icons'
import type { AccountSummaryComponent } from './account-summary.component'

export function accountSummaryTemplate(c: AccountSummaryComponent): TemplateResult {
  const status = c.authStatus()
  if (!status?.authenticated || !status.user) return html``
  const picture = status.user.picture
  return html`
    <div class="account-summary">
      ${picture && !c.avatarFailed
        ? html`<img
            src=${picture}
            alt=""
            referrerpolicy="no-referrer"
            @error=${() => (c.avatarFailed = true)}
          />`
        : html`<span class="account-summary__avatar" aria-hidden="true">
            ${status.user.name.slice(0, 1).toUpperCase()}
          </span>`}
      <span class="account-summary__copy">
        <strong>${status.user.name}</strong>
        <span>${status.user.email}</span>
      </span>
      <button
        type="button"
        class="account-summary__sign-out"
        @click=${() => void signOut()}
        ?disabled=${c.authAction() !== null}
        aria-label="Sign out of Google"
        title="Sign out"
      >
        ${c.authAction() === 'sign-out'
          ? unsafeHTML(icon('loaderCircle', { class: 'spin' }))
          : unsafeHTML(icon('logOut'))}
      </button>
    </div>
  `
}
