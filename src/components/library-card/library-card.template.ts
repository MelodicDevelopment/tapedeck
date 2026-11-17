import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { LibraryCardComponent } from './library-card.component'

export function libraryCardTemplate(c: LibraryCardComponent): TemplateResult {
  return html`
    <li class="library-grid__card">
      <button
        type="button"
        class="library-grid__art"
        @click=${() => c.emit('td:open')}
        ?disabled=${c.disabled}
        title=${c.name}
        aria-label=${c.name}
      >
        ${c.thumbnail
          ? html`<img src=${c.thumbnail} alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : html`<span class="library-grid__placeholder" aria-hidden="true">
              ${unsafeHTML(c.placeholderIcon)}
            </span>`}
        ${c.lastPlayed
          ? html`<span class="library-grid__pill" aria-hidden="true">Last played</span>`
          : html``}
        ${c.kind ? html`<span class="library-grid__kind">${c.kind}</span>` : html``}
      </button>
      <button
        type="button"
        class="library-grid__remove"
        @click=${() => c.emit('td:remove')}
        aria-label=${c.removeLabel}
        title=${c.removeLabel}
      >
        ${unsafeHTML(icon('x'))}
      </button>
      ${c.renamable
        ? html`
            <button
              type="button"
              class="library-grid__remove library-grid__remove--rename"
              @click=${() => c.startRename()}
              aria-label=${`Rename ${c.name}`}
              title="Rename mixtape"
            >
              ${unsafeHTML(icon('pencil'))}
            </button>
          `
        : html``}
      <div class="library-grid__body">
        ${c.editing
          ? html`<input
              class="input library-grid__name-input"
              .value=${c.draftName}
              @input=${(event: Event) => (c.draftName = (event.target as HTMLInputElement).value)}
              @keydown=${(event: KeyboardEvent) => c.onRenameKeyDown(event)}
              @blur=${() => c.commitRename()}
              maxlength="80"
              aria-label="Mixtape name"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
            />`
          : html`<strong>${c.name}</strong>`}
        <span>${c.meta}</span>
      </div>
    </li>
  `
}
