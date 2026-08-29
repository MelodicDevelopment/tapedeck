// NOTE: plain .map() instead of repeat() for the library grid — repeat()
// crashes when nested inside conditionally-rendered sub-templates (candidate
// fix for the melodic repo); Envy's components use .map() the same way.
import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { formatTime, thumbnailUrl } from '../../data/mockPlaylist'
import { formatRelativeTime } from '../../lib/time'
import { icon } from '../../ui/icons'
import type { WelcomeScreenComponent } from './welcome-screen.component'
import { entryKind, KIND_LABELS, LIBRARY_KINDS, type LibraryEntry } from './welcome-screen.types'

const EXAMPLE_URL = 'https://www.youtube.com/@METAL_MUSIC_AI'

function entrySortTimestamp(entry: LibraryEntry): string {
  return entry.data.lastPlayedAt ?? (entry.type === 'source' ? entry.data.savedAt : entry.data.createdAt)
}

function entryThumbnail(entry: LibraryEntry): string {
  if (entry.type === 'source' && entry.data.thumbnail) return entry.data.thumbnail
  const cover = entry.data.tracks.find((track) => !track.unavailable)
  return cover ? thumbnailUrl(cover.id) : ''
}

function entryMeta(entry: LibraryEntry): string {
  const count = entry.data.tracks.length
  const countLabel = `${count} ${count === 1 ? 'track' : 'tracks'}`
  const relative = entry.data.lastPlayedAt
    ? formatRelativeTime(entry.data.lastPlayedAt)
    : entry.type === 'source'
      ? `Saved ${formatRelativeTime(entry.data.savedAt).toLowerCase()}`
      : 'Not played yet'
  return `${countLabel} · ${relative}`
}

export function welcomeScreenTemplate(c: WelcomeScreenComponent): TemplateResult {
  const overlay = c.hasPlayer()
  const library = c.library()
  const hasLibrary = library.sources.length > 0 || library.mixtapes.length > 0
  const authStatus = c.authStatus()
  const checkingAuth = c.desktop && authStatus === null
  const loading = c.view() === 'loading'

  const allEntries: LibraryEntry[] = [
    ...library.sources.map(
      (data): LibraryEntry => ({ type: 'source', key: `source:${data.url}`, data }),
    ),
    ...library.mixtapes.map(
      (data): LibraryEntry => ({ type: 'mixtape', key: `mixtape:${data.id}`, data }),
    ),
  ].sort((a, b) => (entrySortTimestamp(a) < entrySortTimestamp(b) ? 1 : -1))

  const continueEntry = allEntries.find(
    (entry) =>
      entry.data.lastPlayedAt && entry.data.lastTrackId && entry.data.lastPositionSecs != null,
  )

  return html`
    <main class=${overlay ? 'welcome-shell welcome-shell--overlay' : 'welcome-shell'}>
      <header class="welcome-header">
        <div class="welcome-header__left">
          <td-brand></td-brand>
          ${overlay
            ? html`
                <button type="button" class="welcome-header__back" @click=${() => c.close()}>
                  ${unsafeHTML(icon('arrowLeft'))} Back to player
                </button>
              `
            : html``}
        </div>
        <div class="welcome-header__right">
          ${c.desktop
            ? html`<td-sync-chip
                @td:export=${() => c.handleExport()}
                @td:import=${() => c.openImportPicker()}
              ></td-sync-chip>`
            : html`
                <div class="welcome-header__actions">
                  <button
                    type="button"
                    class="welcome-header__icon-button"
                    @click=${() => c.handleExport()}
                    ?disabled=${!hasLibrary}
                    aria-label="Export your library"
                    title="Export library as JSON"
                  >
                    ${unsafeHTML(icon('download'))}
                  </button>
                  <button
                    type="button"
                    class="welcome-header__icon-button"
                    @click=${() => c.openImportPicker()}
                    aria-label="Import a library"
                    title="Import library from JSON"
                  >
                    ${unsafeHTML(icon('upload'))}
                  </button>
                </div>
              `}
          <input
            type="file"
            accept="application/json"
            class="visually-hidden"
            @change=${(event: Event) => c.handleImportFile(event)}
          />
          <td-account-summary></td-account-summary>
        </div>
      </header>
      ${c.importError || c.exportError
        ? html`
            <p class="import-error" role="alert">
              ${unsafeHTML(icon('alertCircle'))}
              ${c.importError || c.exportError}
            </p>
          `
        : html``}

      <section
        class=${hasLibrary && !checkingAuth && !loading ? 'welcome-content welcome-content--library' : 'welcome-content'}
        aria-live="polite"
      >
        <div class=${hasLibrary ? 'welcome-stack welcome-stack--wide' : 'welcome-stack'}>
          ${checkingAuth
            ? html`
                <div class="loading-state" role="status">
                  ${unsafeHTML(icon('loaderCircle', { class: 'loading-state__spinner' }))}
                  <h1>Checking your Google sign-in…</h1>
                  <p>Your login stays in the operating system credential vault.</p>
                </div>
              `
            : loading
              ? html`
                  <div class="loading-state" role="status">
                    ${unsafeHTML(icon('loaderCircle', { class: 'loading-state__spinner' }))}
                    <h1>Fetching from YouTube…</h1>
                    <p>Reading the playlist and video titles. This usually takes a moment.</p>
                  </div>
                `
              : hasLibrary
                ? libraryView(c, allEntries, continueEntry)
                : welcomeCard(c)}
        </div>
      </section>

      <footer class="welcome-footer">
        Plays videos directly from <strong>YouTube</strong>
        <span aria-hidden="true"> · </span>
        nothing is downloaded
      </footer>
    </main>
  `
}

function pasteForm(c: WelcomeScreenComponent): TemplateResult {
  const needsSignIn = c.desktop && !c.authStatus()?.authenticated
  const formDisabled = needsSignIn || c.authAction() !== null
  const error = c.error()
  return html`
    <form @submit=${(event: Event) => c.submit(event)} class="source-form" novalidate>
      <div class="source-form__row">
        <input
          class=${error ? 'input input--error' : 'input'}
          .value=${c.url()}
          @input=${(event: Event) => c.onUrlInput(event)}
          placeholder="Paste a YouTube video, channel, or playlist URL…"
          aria-label="YouTube video, channel, or playlist URL"
          aria-invalid=${error ? 'true' : 'false'}
          aria-describedby=${error ? 'source-error' : undefined}
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          ?disabled=${formDisabled}
        />
        <button class="button button--primary" type="submit" ?disabled=${formDisabled}>
          Load
        </button>
      </div>
      ${error
        ? html`
            <p class="source-form__error" id="source-error" role="alert">
              ${unsafeHTML(icon('alertCircle'))}
              ${error}
            </p>
          `
        : html``}
    </form>
  `
}

function authGate(c: WelcomeScreenComponent): TemplateResult {
  const authStatus = c.authStatus()
  const signingIn = c.authAction() === 'sign-in'
  return html`
    <div class="auth-gate">
      <div class="auth-gate__copy">
        ${unsafeHTML(icon('shieldCheck'))}
        <div>
          <strong>
            ${authStatus?.configured
              ? 'Connect your YouTube account'
              : 'Google sign-in needs configuration'}
          </strong>
          <span>
            ${authStatus?.configured
              ? 'Sign in securely in your browser. Tapedeck requests read-only YouTube access.'
              : 'This development build is missing its Google OAuth client credentials in .env.'}
          </span>
        </div>
      </div>
      <button
        class="google-button"
        type="button"
        @click=${() => c.signIn()}
        ?disabled=${!authStatus?.configured || signingIn}
      >
        ${signingIn
          ? html`${unsafeHTML(icon('loaderCircle', { class: 'spin' }))} Finish in your browser…`
          : html`<span class="google-button__mark" aria-hidden="true">G</span> Continue with Google`}
      </button>
    </div>
  `
}

function libraryView(
  c: WelcomeScreenComponent,
  allEntries: LibraryEntry[],
  continueEntry: LibraryEntry | undefined,
): TemplateResult {
  const needsSignIn = c.desktop && !c.authStatus()?.authenticated
  const formDisabled = needsSignIn || c.authAction() !== null
  const query = c.libraryQuery.trim().toLowerCase()

  const continueTrack = continueEntry?.data.tracks.find(
    (track) => track.id === continueEntry.data.lastTrackId,
  )
  const continueElapsed = continueEntry?.data.lastPositionSecs ?? 0
  const continueProgress =
    continueTrack && continueTrack.duration > 0
      ? Math.min(100, (continueElapsed / continueTrack.duration) * 100)
      : 0

  const kind = c.libraryKind
  const kindCounts = new Map<string, number>()
  for (const entry of allEntries) {
    const k = entryKind(entry)
    kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1)
  }
  const byKind = kind === 'all' ? allEntries : allEntries.filter((entry) => entryKind(entry) === kind)
  const filteredEntries = query
    ? byKind.filter((entry) => entry.data.name.toLowerCase().includes(query))
    : byKind
  const noMatches = filteredEntries.length === 0

  return html`
    <div class="library-layout">
      <aside class="library-rail">
        <div class="library__group">
          <p class="library__heading">Add a source</p>
          ${pasteForm(c)}
        </div>

        ${needsSignIn ? authGate(c) : html``}

        ${continueEntry && continueTrack
          ? html`
              <div class="library__group">
                <p class="library__heading">Continue listening</p>
                <div class="continue-card">
                  <button
                    type="button"
                    class="continue-card__art"
                    @click=${() => c.openEntry(continueEntry)}
                    aria-label=${`Resume ${continueEntry.data.name}`}
                  >
                    ${entryThumbnail(continueEntry)
                      ? html`<img src=${entryThumbnail(continueEntry)} alt="" referrerpolicy="no-referrer" />`
                      : html`<span class="continue-card__placeholder" aria-hidden="true">
                          ${unsafeHTML(icon('play'))}
                        </span>`}
                    <span class="continue-card__play" aria-hidden="true">
                      ${unsafeHTML(icon('play', { fill: true }))}
                    </span>
                  </button>
                  <div class="continue-card__copy">
                    <strong>${continueTrack.title}</strong>
                    <span>
                      ${continueEntry.data.name} · ${formatTime(continueElapsed)} of
                      ${formatTime(continueTrack.duration)}
                    </span>
                    <div class="continue-card__progress">
                      <div style=${`width: ${continueProgress}%`}></div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="button button--primary button--small"
                    @click=${() => c.openEntry(continueEntry)}
                  >
                    Resume
                  </button>
                </div>
              </div>
            `
          : html``}
      </aside>

      <section class="library" aria-label="Your library">
        <div class="library__group-header">
          <div class="library__group-header-left">
            <p class="library__heading">Your library · ${allEntries.length} saved</p>
            <div class="library__kinds" role="group" aria-label="Filter by kind">
              ${LIBRARY_KINDS.filter((option) => option.id === 'all' || (kindCounts.get(option.id) ?? 0) > 0).map(
                (option) => html`
                  <button
                    type="button"
                    class=${option.id === kind ? 'library__kind library__kind--active' : 'library__kind'}
                    @click=${() => c.setKind(option.id)}
                    aria-pressed=${option.id === kind ? 'true' : 'false'}
                  >
                    ${option.label}
                    ${option.id !== 'all'
                      ? html`<span class="library__kind-count">${kindCounts.get(option.id) ?? 0}</span>`
                      : html``}
                  </button>
                `,
              )}
            </div>
          </div>
          <div class="library__search">
            ${unsafeHTML(icon('search'))}
            <input
              type="search"
              .value=${c.libraryQuery}
              @input=${(event: Event) => c.onQueryInput(event)}
              placeholder="Search library"
              aria-label="Search your library"
            />
          </div>
        </div>

        ${noMatches
          ? html`<p class="library__empty">
              ${query ? `No matches for “${c.libraryQuery.trim()}”.` : 'Nothing of this kind saved yet.'}
            </p>`
          : html`
              <ul class="library-grid">
                ${filteredEntries.map(
                  (entry) => html`
                    <td-library-card
                      .name=${entry.data.name}
                      .meta=${entryMeta(entry)}
                      .kind=${KIND_LABELS[entryKind(entry)]}
                      .thumbnail=${entryThumbnail(entry)}
                      .placeholderIcon=${entry.type === 'mixtape' ? icon('cassetteTape') : icon('history')}
                      .lastPlayed=${continueEntry?.key === entry.key}
                      .disabled=${entry.type === 'source' ? formDisabled : entry.data.tracks.length === 0}
                      .removeLabel=${entry.type === 'source'
                        ? `Remove ${entry.data.name} from saved sources`
                        : `Delete mixtape ${entry.data.name}`}
                      @td:open=${() => c.openEntry(entry)}
                      @td:remove=${() => c.removeEntry(entry)}
                    ></td-library-card>
                  `,
                )}
              </ul>
            `}
      </section>
    </div>
  `
}

function welcomeCard(c: WelcomeScreenComponent): TemplateResult {
  const needsSignIn = c.desktop && !c.authStatus()?.authenticated
  return html`
    <div class="welcome-card">
      <p class="eyebrow">YOUR MUSIC, LESS NOISE</p>
      <h1>Play the channels you love</h1>
      <p class="welcome-card__copy">
        Paste a YouTube video, channel, or playlist and Tapedeck turns it into a clean, distraction-free
        music player.
      </p>

      ${needsSignIn ? authGate(c) : html``}
      ${pasteForm(c)}

      ${!c.error()
        ? html`
            <div class="source-form__helpers">
              <p class="source-form__helper">
                Try
                <button type="button" @click=${() => c.useExampleUrl(EXAMPLE_URL)}>
                  youtube.com/@METAL_MUSIC_AI
                </button>
              </p>
            </div>
          `
        : html``}
    </div>
  `
}
