import { html, repeat, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { formatTime, thumbnailUrl, type Playlist, type Track } from '../../data/mockPlaylist'
import { parseVolumeBadge } from '../../lib/trackTitle'
import { icon } from '../../ui/icons'
import type { PlayerScreenComponent } from './player-screen.component'

export function playerScreenTemplate(c: PlayerScreenComponent): TemplateResult {
  const playlist = c.activePlaylist()
  const track = c.track()
  if (!playlist || !track) return html``

  const unavailable = c.unavailable()
  const mode = c.mode()
  // Nothing to show in audio mode when the track can't play at all — fall
  // back to the video frame's own unavailable-state message.
  const showAudioMode = mode === 'audio' && !unavailable
  const watchUrl = `https://www.youtube.com/watch?v=${track.id}`
  const channelUrl = playlist.sourceUrl.startsWith('http') ? playlist.sourceUrl : null

  return html`
    <main class="loaded-shell">
      <div class="player-workspace">
        <aside class="queue-panel" aria-label="Video queue">
          <td-source-switcher></td-source-switcher>

          <div class="queue-heading">
            <span>${unsafeHTML(icon('listMusic'))} Up next</span>
            <button
              type="button"
              class="queue-heading__jump"
              @click=${() => c.scrollToCurrent()}
              aria-label="Scroll to the current track"
              title="Scroll to the current track"
            >
              ${unsafeHTML(icon('target'))} ${playlist.tracks.length} tracks
            </button>
          </div>

          <ol class="track-list" aria-label="Tracks" @scroll=${() => c.clearHover()}>
            ${repeat(
              playlist.tracks,
              (item) => item.id,
              (item, index) => trackRow(c, item, index),
            )}
          </ol>
        </aside>

        <section class="player-panel" aria-label="Now playing">
          <header class="player-header">
            <div class="player-header__left">
              <td-brand compact></td-brand>
              <button
                type="button"
                class="player-header__back"
                @click=${() => c.backToLibrary()}
                aria-label="Back to your library"
                title="Back to your library"
              >
                ${unsafeHTML(icon('arrowLeft'))} Library
              </button>
            </div>

            <div class="mode-toggle" role="group" aria-label="Playback mode">
              <button
                type="button"
                class=${mode === 'video' ? 'mode-toggle__option mode-toggle__option--active' : 'mode-toggle__option'}
                @click=${() => c.setMode('video')}
                aria-pressed=${mode === 'video' ? 'true' : 'false'}
              >
                ${unsafeHTML(icon('video'))} Video
              </button>
              <button
                type="button"
                class=${mode === 'audio' ? 'mode-toggle__option mode-toggle__option--active' : 'mode-toggle__option'}
                @click=${() => c.setMode('audio')}
                aria-pressed=${mode === 'audio' ? 'true' : 'false'}
              >
                ${unsafeHTML(icon('music'))} Audio
              </button>
            </div>

            <div class="player-header__right">
              <span class="youtube-source">
                ${unsafeHTML(icon('youtube'))}
                Streaming from YouTube
              </span>
              <button
                type="button"
                class="player-header__icon-button"
                @click=${() => c.openShortcuts()}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
              >
                ${unsafeHTML(icon('helpCircle'))}
              </button>
              <td-account-summary></td-account-summary>
            </div>
          </header>

          <div class="player-stage">
            ${showAudioMode ? audioMode(c, track, playlist, watchUrl, channelUrl, unavailable) : html``}

            <div
              class=${`video-frame${unavailable ? ' video-frame--unavailable' : ''}${showAudioMode ? ' video-frame--hidden' : ''}`}
            >
              ${unavailable
                ? html`
                    <div class="unavailable-state" role="status">
                      ${unsafeHTML(icon('circleOff'))}
                      <h2>This video is unavailable</h2>
                      <p>It may be private or removed on YouTube. You can skip it and keep listening.</p>
                      <button class="button button--primary button--small" @click=${() => c.next()}>
                        Skip to next
                      </button>
                    </div>
                  `
                : html`<td-youtube-player></td-youtube-player>`}
            </div>

            ${!showAudioMode ? trackDetails(c, track, playlist, watchUrl, channelUrl, unavailable) : html``}
          </div>
        </section>
      </div>

      <td-playback-bar></td-playback-bar>

      ${c.pickerTrack() ? html`<td-mixtape-picker></td-mixtape-picker>` : html``}
      ${c.shortcutsOpen() ? html`<td-shortcuts-modal></td-shortcuts-modal>` : html``}
    </main>
  `
}

function trackRow(c: PlayerScreenComponent, item: Track, index: number): TemplateResult {
  const isCurrent = index === c.currentIndex()
  const isUnavailable = Boolean(item.unavailable || c.failedVideoIds().has(item.id))
  const activeMixtapeId = c.playingMixtapeId()
  const reorderable = Boolean(activeMixtapeId)
  const badge = parseVolumeBadge(item.title)
  const playing = c.playing()
  const itemClass = `track-item${reorderable && c.dragOverIndex === index ? ' track-item--drag-over' : ''}${
    c.hoveredIndex === index ? ' track-item--hovered' : ''
  }`
  return html`
    <li
      class=${itemClass}
      ?draggable=${reorderable}
      @mouseenter=${() => (c.hoveredIndex = index)}
      @mouseleave=${() => {
        if (c.hoveredIndex === index) c.hoveredIndex = null
      }}
      @dragstart=${(event: DragEvent) => {
        if (!reorderable) return
        void event
        c.dragIndex = index
      }}
      @dragover=${(event: DragEvent) => {
        if (!reorderable) return
        event.preventDefault()
        c.dragOverIndex = index
      }}
      @dragleave=${() => {
        if (reorderable && c.dragOverIndex === index) c.dragOverIndex = null
      }}
      @drop=${(event: DragEvent) => {
        if (!reorderable) return
        event.preventDefault()
        c.handleDrop(index)
      }}
      @dragend=${() => {
        if (!reorderable) return
        c.dragIndex = null
        c.dragOverIndex = null
      }}
    >
      ${reorderable
        ? html`<span class="track-item__grip" aria-hidden="true">
            ${unsafeHTML(icon('gripVertical'))}
          </span>`
        : html``}
      <button
        class=${isCurrent ? 'track-row track-row--current' : 'track-row'}
        @click=${() => c.selectTrack(index)}
        aria-current=${isCurrent ? 'true' : undefined}
      >
        <span class="track-row__thumb">
          ${!item.unavailable ? html`<img src=${thumbnailUrl(item.id)} alt="" loading="lazy" />` : html``}
          ${isCurrent && !isUnavailable
            ? html`
                <span
                  class=${playing ? 'playing-bars playing-bars--active' : 'playing-bars'}
                  aria-label=${playing ? 'Currently playing' : 'Selected'}
                >
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
              `
            : html``}
        </span>
        <span class="track-row__copy">
          <strong class=${isUnavailable ? 'muted' : ''}>
            ${badge
              ? html`<span
                  class=${isCurrent ? 'track-row__badge track-row__badge--current' : 'track-row__badge'}
                >
                  ${badge.badge}
                </span>`
              : html``}
            ${badge?.rest ?? item.title}
          </strong>
          <span>${isUnavailable ? 'Unavailable on YouTube' : item.artist}</span>
        </span>
        <time>${formatTime(item.duration)}</time>
      </button>
      ${!isUnavailable
        ? activeMixtapeId
          ? html`
              <button
                class="track-item__action"
                @click=${() => c.removeFromMixtape(item)}
                aria-label=${`Remove ${item.title} from this mixtape`}
                title="Remove from mixtape"
              >
                ${unsafeHTML(icon('x'))}
              </button>
            `
          : html`
              <button
                class="track-item__action"
                @click=${() => c.pickTrack(item)}
                aria-label=${`Add ${item.title} to a mixtape`}
                title="Add to mixtape"
              >
                ${unsafeHTML(icon('listPlus'))}
              </button>
            `
        : html``}
    </li>
  `
}

function nowPlayingLabel(c: PlayerScreenComponent): TemplateResult {
  if (c.externalVideo()) {
    return html`
      <button type="button" class="track-details__back-to-queue" @click=${() => c.returnToQueue()}>
        ${unsafeHTML(icon('arrowLeft'))} Back to queue
      </button>
    `
  }
  return html`
    <p class="track-details__label">
      NOW PLAYING
      ${c.externalVideoLoading()
        ? unsafeHTML(icon('loaderCircle', { class: 'track-details__loading spin' }))
        : html``}
    </p>
  `
}

function audioMode(
  c: PlayerScreenComponent,
  track: Track,
  playlist: Playlist,
  watchUrl: string,
  channelUrl: string | null,
  unavailable: boolean,
): TemplateResult {
  const playing = c.playing()
  return html`
    <div class="audio-mode">
      <div class="audio-mode__art">
        <img src=${thumbnailUrl(track.id)} alt="" />
        <span
          class=${playing ? 'audio-mode__reel audio-mode__reel--spinning' : 'audio-mode__reel'}
          aria-hidden="true"
        >
          <span class="audio-mode__reel-ring"></span>
          <span class="audio-mode__reel-hub"></span>
        </span>
      </div>
      <div class="audio-mode__copy">
        ${nowPlayingLabel(c)}
        <h1>
          ${unavailable
            ? track.title
            : html`<a href=${watchUrl} target="_blank" rel="noreferrer">${track.title}</a>`}
        </h1>
        <p>
          ${channelUrl
            ? html`<a href=${channelUrl} target="_blank" rel="noreferrer">${track.artist}</a>`
            : track.artist}
          <span aria-hidden="true">·</span> ${formatTime(track.duration)}
        </p>
        <button type="button" class="audio-mode__show-video" @click=${() => c.setMode('video')}>
          <img src=${thumbnailUrl(track.id)} alt="" /> Show video
        </button>
      </div>
    </div>
  `
}

function trackDetails(
  c: PlayerScreenComponent,
  track: Track,
  playlist: Playlist,
  watchUrl: string,
  channelUrl: string | null,
  unavailable: boolean,
): TemplateResult {
  return html`
    <div class="track-details">
      <div>
        ${nowPlayingLabel(c)}
        <h1>
          ${unavailable
            ? track.title
            : html`<a href=${watchUrl} target="_blank" rel="noreferrer">${track.title}</a>`}
        </h1>
        <p class="track-details__meta">
          ${channelUrl
            ? html`<a href=${channelUrl} target="_blank" rel="noreferrer">${track.artist}</a>`
            : track.artist}
          <span aria-hidden="true">·</span> YouTube video
        </p>
      </div>
      <button type="button" class="track-details__jump" @click=${() => c.scrollToCurrent()}>
        Track ${c.currentIndex() + 1} of ${playlist.tracks.length}
      </button>
    </div>
  `
}
