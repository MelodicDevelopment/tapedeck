import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { icon } from '../../ui/icons'
import type { TitleBarComponent } from './title-bar.component'

export function titleBarTemplate(c: TitleBarComponent): TemplateResult {
  return html`
    <div class="app-titlebar" data-tauri-drag-region>
      <span class="app-titlebar__title" data-tauri-drag-region>Tapedeck</span>
      <div class="app-titlebar__controls">
        <button
          type="button"
          class="app-titlebar__button"
          aria-label="Minimize"
          @click=${() => c.minimize()}
        >
          ${unsafeHTML(icon('minus', { size: 16 }))}
        </button>
        <button
          type="button"
          class="app-titlebar__button"
          aria-label=${c.maximized ? 'Restore' : 'Maximize'}
          @click=${() => c.toggleMaximize()}
        >
          ${c.maximized
            ? unsafeHTML(icon('copy', { size: 14 }))
            : unsafeHTML(icon('square', { size: 13 }))}
        </button>
        <button
          type="button"
          class="app-titlebar__button app-titlebar__button--close"
          aria-label="Close"
          @click=${() => c.close()}
        >
          ${unsafeHTML(icon('x', { size: 16 }))}
        </button>
      </div>
    </div>
  `
}
