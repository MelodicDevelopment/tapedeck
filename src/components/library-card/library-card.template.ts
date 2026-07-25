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
      <div class="library-grid__body">
        <strong>${c.name}</strong>
        <span>${c.meta}</span>
      </div>
    </li>
  `
}
