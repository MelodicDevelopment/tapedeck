import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { formatTime, thumbnailUrl } from '../../data/mockPlaylist'
import type { RepeatMode } from '../../lib/playback'
import { icon } from '../../ui/icons'
import type { PlaybackBarComponent } from './playback-bar.component'

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: 'Repeat the whole playlist',
  all: 'Repeat the current song',
  one: 'Turn repeat off',
}

export function playbackBarTemplate(c: PlaybackBarComponent): TemplateResult {
  const track = c.track()
  if (!track) return html``
  const playing = c.playing()
  const unavailable = c.unavailable()
  const elapsed = c.elapsed()
  const duration = c.duration()
  const volume = c.volume()
  const shuffle = c.shuffle()
  const repeatMode = c.repeatMode()
  const progress = duration ? Math.min(100, (elapsed / duration) * 100) : 0
  const volumeIcon = volume === 0 ? 'volumeX' : volume < 55 ? 'volume1' : 'volume2'

  return html`
    <footer class="playback-bar" aria-label="Playback controls">
      <div class="now-playing">
        ${track.unavailable
          ? html`<span class="now-playing__thumb" aria-hidden="true"></span>`
          : html`<img src=${thumbnailUrl(track.id)} alt="" />`}
        <div class="now-playing__text">
          <strong>${track.title}</strong>
          <span>${track.artist}</span>
        </div>
      </div>

      <div class="playback-center">
        <div class="transport-controls">
          <button
            class=${shuffle ? 'icon-button icon-button--mode icon-button--on' : 'icon-button icon-button--mode'}
            @click=${() => c.onToggleShuffle()}
            aria-label=${shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
            aria-pressed=${shuffle ? 'true' : 'false'}
            title="Shuffle"
          >
            ${unsafeHTML(icon('shuffle'))}
          </button>
          <button class="icon-button" @click=${() => c.previous()} aria-label="Previous track">
            ${unsafeHTML(icon('skipBack'))}
          </button>
          <button
            class="play-button"
            @click=${() => c.toggle()}
            aria-label=${playing ? 'Pause' : 'Play'}
            ?disabled=${unavailable}
          >
            ${playing
              ? unsafeHTML(icon('pause', { fill: true }))
              : unsafeHTML(icon('play', { fill: true }))}
          </button>
          <button class="icon-button" @click=${() => c.next()} aria-label="Next track">
            ${unsafeHTML(icon('skipForward'))}
          </button>
          <button
            class=${repeatMode !== 'off' ? 'icon-button icon-button--mode icon-button--on' : 'icon-button icon-button--mode'}
            @click=${() => c.onCycleRepeat()}
            aria-label=${REPEAT_LABELS[repeatMode]}
            title=${repeatMode === 'one' ? 'Repeating this song' : repeatMode === 'all' ? 'Repeating playlist' : 'Repeat'}
          >
            ${repeatMode === 'one' ? unsafeHTML(icon('repeat1')) : unsafeHTML(icon('repeat'))}
          </button>
        </div>

        <div class="progress-control">
          <time>${formatTime(unavailable ? 0 : elapsed)}</time>
          <input
            class="range range--progress"
            type="range"
            min="0"
            max=${Math.max(duration, 1)}
            step="1"
            .value=${String(unavailable ? 0 : Math.min(elapsed, duration))}
            @input=${(event: Event) => c.onSeek(event)}
            style=${`--range-progress: ${progress}%`}
            aria-label="Seek through current video"
            ?disabled=${unavailable}
          />
          <time>-${formatTime(Math.max(0, duration - elapsed))}</time>
        </div>
      </div>

      <div class="volume-control">
        <button
          class="volume-control__button"
          aria-label=${volume === 0 ? 'Unmute' : 'Mute'}
          @click=${() => c.toggleMute()}
        >
          ${unsafeHTML(icon(volumeIcon))}
        </button>
        <input
          class="range"
          type="range"
          min="0"
          max="100"
          .value=${String(volume)}
          @input=${(event: Event) => c.onVolumeInput(event)}
          style=${`--range-progress: ${volume}%`}
          aria-label="Volume"
        />
      </div>
    </footer>
  `
}
