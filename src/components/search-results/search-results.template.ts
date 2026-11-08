import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import type { SearchResult } from '../../api/youtube'
import { formatTime } from '../../data/mockPlaylist'
import { icon } from '../../ui/icons'
import { keyed } from '../../ui/keyed'
import type { SearchResultsComponent } from './search-results.component'

export function searchResultsTemplate(c: SearchResultsComponent): TemplateResult {
  const query = c.searchQuery()
  const status = c.searchStatus()
  const results = c.searchResults() ?? []
  const summary =
    status === 'loading'
      ? 'Searching YouTube…'
      : status === 'error'
        ? 'Search failed'
        : results.length === 0
          ? 'No videos found'
          : `${results.length} video${results.length === 1 ? '' : 's'}`

  return html`
    <section class="results" aria-label="YouTube search results" aria-busy=${status === 'loading' ? 'true' : 'false'}>
      <header class="results__header">
        <div class="results__title">
          <p class="results__heading">YouTube search · ${summary}</p>
          <h2>“${query}”</h2>
        </div>
        <button type="button" class="results__close" @click=${() => c.close()}>
          ${unsafeHTML(icon('x'))} Back to library
        </button>
      </header>

      ${status === 'loading'
        ? html`
            <div class="results__state" role="status">
              ${unsafeHTML(icon('loaderCircle', { class: 'spin' }))}
              <p>Looking for “${query}” on YouTube…</p>
            </div>
          `
        : status === 'error'
          ? html`
              <div class="results__state results__state--error" role="alert">
                ${unsafeHTML(icon('alertCircle'))}
                <p>${c.searchError()}</p>
                <button type="button" class="button button--primary button--small" @click=${() => c.retry()}>
                  Try again
                </button>
              </div>
            `
          : results.length === 0
            ? html`
                <div class="results__state">
                  ${unsafeHTML(icon('search'))}
                  <p>Nothing matched “${query}”. Try different words, or paste a link instead.</p>
                </div>
              `
            : html`
                <ul class="results__grid">
                  ${results.map((result) => keyed(result.id, resultCard(c, result)))}
                </ul>
              `}
    </section>
  `
}

function resultCard(c: SearchResultsComponent, result: SearchResult): TemplateResult {
  const inMixtapes = c.mixtapesWith(result.id)
  return html`
    <li class="result-card">
      <button
        type="button"
        class="result-card__art"
        @click=${() => c.play(result)}
        aria-label=${`Play ${result.title}`}
        title="Play"
      >
        <img src=${result.thumbnail} alt="" loading="lazy" />
        ${result.duration > 0
          ? html`<span class="result-card__duration">${formatTime(result.duration)}</span>`
          : html``}
        <span class="result-card__play" aria-hidden="true">${unsafeHTML(icon('play', { fill: true }))}</span>
      </button>
      <div class="result-card__body">
        <button type="button" class="result-card__title" @click=${() => c.play(result)} title=${result.title}>
          ${result.title}
        </button>
        <p class="result-card__meta">
          ${result.channel}
          ${inMixtapes.length > 0
            ? html`<span class="result-card__saved" title=${`In ${inMixtapes.join(', ')}`}>
                ${unsafeHTML(icon('check'))} In ${inMixtapes.length === 1 ? inMixtapes[0] : `${inMixtapes.length} mixtapes`}
              </span>`
            : html``}
        </p>
        <div class="result-card__actions">
          <button type="button" class="button button--primary button--small" @click=${() => c.play(result)}>
            ${unsafeHTML(icon('play', { fill: true }))} Play
          </button>
          <button
            type="button"
            class="result-card__add"
            @click=${() => c.addToMixtape(result)}
            aria-label=${`Add ${result.title} to a mixtape`}
          >
            ${unsafeHTML(icon('listPlus'))} Add to mixtape
          </button>
        </div>
      </div>
    </li>
  `
}
