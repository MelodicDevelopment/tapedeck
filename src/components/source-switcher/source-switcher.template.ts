// NOTE: plain .map() instead of repeat() for these lists — repeat() crashes
// when nested inside conditionally-rendered sub-templates (candidate fix for
// the melodic repo); Envy's components use .map() the same way.
import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { thumbnailUrl, type Playlist } from '../../data/mockPlaylist'
import { changeSource, openSavedSource, playMixtape } from '../../store/actions'
import { icon } from '../../ui/icons'
import type { SourceSwitcherComponent } from './source-switcher.component'

export function sourceSwitcherTemplate(c: SourceSwitcherComponent): TemplateResult {
  const playlist = c.activePlaylist()
  if (!playlist) return html``
  return html`
    <div class="source-card">
      <button
        type="button"
        class="source-card__trigger"
        @click=${() => (c.open = !c.open)}
        aria-expanded=${c.open ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-label=${`Switch from ${playlist.name}`}
      >
        <img
          class="source-card__art"
          src=${playlist.thumbnail || thumbnailUrl(playlist.tracks[0].id)}
          alt=""
        />
        <div class="source-card__copy">
          <strong>${playlist.name}</strong>
          <span>${playlist.kind} · ${playlist.tracks.length} videos</span>
        </div>
        ${unsafeHTML(icon('chevronDown', { class: 'source-card__chevron' }))}
      </button>

      ${c.open ? switcherList(c, playlist) : html``}
    </div>
  `
}

function switcherList(c: SourceSwitcherComponent, playlist: Playlist): TemplateResult {
  const mixtapes = c.library().mixtapes
  const sources = c.library().sources
  const activeMixtapeId = c.playingMixtapeId()
  return html`
    <div class="source-switcher" role="listbox">
      ${mixtapes.length > 0
        ? html`
            <p class="source-switcher__label">Mixtapes</p>
            ${mixtapes.map(
              (mixtape) => {
                const cover = mixtape.tracks.find((entry) => !entry.unavailable)
                const active = activeMixtapeId === mixtape.id
                return html`
                  <button
                    type="button"
                    class="source-switcher__row"
                    role="option"
                    aria-selected=${active ? 'true' : 'false'}
                    @click=${() => c.choose(() => playMixtape(mixtape.id))}
                  >
                    <span class="source-switcher__thumb">
                      ${cover
                        ? html`<img src=${thumbnailUrl(cover.id)} alt="" loading="lazy" />`
                        : unsafeHTML(icon('cassetteTape'))}
                    </span>
                    <span class="source-switcher__copy">
                      <strong>${mixtape.name}</strong>
                      <span>
                        ${mixtape.tracks.length} ${mixtape.tracks.length === 1 ? 'track' : 'tracks'}
                      </span>
                    </span>
                    ${active
                      ? unsafeHTML(icon('check', { class: 'source-switcher__check' }))
                      : html``}
                  </button>
                `
              },
            )}
          `
        : html``}

      ${sources.length > 0
        ? html`
            <p class="source-switcher__label">Saved</p>
            ${sources.map(
              (source) => {
                const active = !activeMixtapeId && playlist.sourceUrl === source.url
                return html`
                  <button
                    type="button"
                    class="source-switcher__row"
                    role="option"
                    aria-selected=${active ? 'true' : 'false'}
                    @click=${() => c.choose(() => openSavedSource(source.url))}
                  >
                    <span class="source-switcher__thumb">
                      ${source.thumbnail
                        ? html`<img
                            src=${source.thumbnail}
                            alt=""
                            loading="lazy"
                            referrerpolicy="no-referrer"
                          />`
                        : unsafeHTML(icon('history'))}
                    </span>
                    <span class="source-switcher__copy">
                      <strong>${source.name}</strong>
                      <span>
                        ${source.tracks.length} ${source.tracks.length === 1 ? 'track' : 'tracks'}
                      </span>
                    </span>
                    ${active
                      ? unsafeHTML(icon('check', { class: 'source-switcher__check' }))
                      : html``}
                  </button>
                `
              },
            )}
          `
        : html``}

      <div class="source-switcher__divider"></div>
      <button
        type="button"
        class="source-switcher__row source-switcher__row--new"
        @click=${() => c.choose(changeSource)}
      >
        ${unsafeHTML(icon('plus'))} Load a new URL…
      </button>
    </div>
  `
}
