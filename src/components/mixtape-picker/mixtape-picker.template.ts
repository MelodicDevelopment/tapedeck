// NOTE: plain .map() instead of repeat() — repeat() crashes when nested
// inside conditionally-rendered sub-templates (candidate fix for the melodic
// repo); Envy's components use .map() the same way.
import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { mixtapeHasTrack } from '../../lib/library'
import { icon } from '../../ui/icons'
import type { MixtapePickerComponent } from './mixtape-picker.component'

export function mixtapePickerTemplate(c: MixtapePickerComponent): TemplateResult {
  const track = c.pickerTrack()
  if (!track) return html``
  const mixtapes = c.library().mixtapes
  return html`
    <div class="modal-backdrop" @click=${() => c.close()}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label=${`Add “${track.title}” to a mixtape`}
        @click=${(event: Event) => event.stopPropagation()}
      >
        <header class="modal__header">
          <div class="modal__title">
            <strong>Add to mixtape</strong>
            <span>${track.title}</span>
          </div>
          <button type="button" class="modal__close" @click=${() => c.close()} aria-label="Close">
            ${unsafeHTML(icon('x'))}
          </button>
        </header>

        ${mixtapes.length > 0
          ? html`
              <ul class="mixtape-options">
                ${mixtapes.map(
                  (mixtape) => {
                    const added = mixtapeHasTrack(mixtape, track.id)
                    return html`
                      <li>
                        <button
                          type="button"
                          class=${added ? 'mixtape-option mixtape-option--added' : 'mixtape-option'}
                          @click=${() => c.toggle(mixtape.id, track)}
                          aria-pressed=${added ? 'true' : 'false'}
                        >
                          ${unsafeHTML(icon('cassetteTape'))}
                          <span class="mixtape-option__copy">
                            <strong>${mixtape.name}</strong>
                            <span>
                              ${mixtape.tracks.length}
                              ${mixtape.tracks.length === 1 ? 'video' : 'videos'}
                            </span>
                          </span>
                          ${added
                            ? unsafeHTML(icon('check', { class: 'mixtape-option__check' }))
                            : html``}
                        </button>
                      </li>
                    `
                  },
                )}
              </ul>
            `
          : html`
              <p class="mixtape-options__empty">
                No mixtapes yet. Name your first one below and this video starts it off.
              </p>
            `}

        <form class="mixtape-create" @submit=${(event: Event) => c.create(event)}>
          <input
            class="input"
            .value=${c.name}
            @input=${(event: Event) => (c.name = (event.target as HTMLInputElement).value)}
            placeholder="New mixtape name"
            aria-label="New mixtape name"
            maxlength="80"
          />
          <button class="button button--primary" type="submit" ?disabled=${!c.name.trim()}>
            ${unsafeHTML(icon('plus'))} Create
          </button>
        </form>
      </div>
    </div>
  `
}
