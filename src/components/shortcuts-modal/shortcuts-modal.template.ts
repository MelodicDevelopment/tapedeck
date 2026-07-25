import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { ShortcutsModalComponent } from './shortcuts-modal.component'

const ROWS: { label: string; keys: string[] }[] = [
  { label: 'Play / pause', keys: ['Space'] },
  { label: 'Next track', keys: ['→'] },
  { label: 'Previous track', keys: ['←'] },
  { label: 'Volume up', keys: ['↑'] },
  { label: 'Volume down', keys: ['↓'] },
  { label: 'Toggle shuffle', keys: ['⇧', 'S'] },
  { label: 'Shortcuts', keys: ['?'] },
  { label: 'Close', keys: ['Esc'] },
]

export function shortcutsModalTemplate(c: ShortcutsModalComponent): TemplateResult {
  return html`
    <div class="modal-backdrop" @click=${() => c.close()}>
      <div
        class="modal shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <header class="shortcuts-modal__header">
          <strong>Keyboard shortcuts</strong>
          <button type="button" class="modal__close" @click=${() => c.close()} aria-label="Close">
            ${unsafeHTML(icon('x'))}
          </button>
        </header>
        <ul class="shortcuts-modal__list">
          ${ROWS.map(
            (row) => html`
              <li>
                <span>${row.label}</span>
                <span class="shortcuts-modal__keys">
                  ${row.keys.map((key) => html`<kbd>${key}</kbd>`)}
                </span>
              </li>
            `,
          )}
        </ul>
      </div>
    </div>
  `
}
