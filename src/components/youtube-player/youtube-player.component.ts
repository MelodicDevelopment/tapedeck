import { MelodicComponent } from '@melodicdev/core'
import {
  elapsedNow,
  handleEnded,
  markUnavailable,
  playing,
  reportProgress,
  seekTo,
  track,
  volume,
} from '../../store/player'
import { youTubePlayerTemplate } from './youtube-player.template'
import { youTubePlayerStyles } from './youtube-player.styles'

let apiPromise: Promise<void> | null = null

/** Loads the YouTube IFrame API once, resolving when `window.YT.Player` exists. */
function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  apiPromise ??= new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }
    if (!document.querySelector('script[data-tapedeck-youtube-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.dataset.tapedeckYoutubeApi = 'true'
      document.head.appendChild(script)
    }
  })
  return apiPromise
}

/**
 * td-youtube-player — wraps the YouTube IFrame API player. The player is
 * recreated when the on-screen track changes; play/pause, volume, and seek
 * requests are diffed against the last applied values on each render
 * (the React build's per-prop effects).
 *
 * Shadow DOM note: the YT API accepts an element reference (never an id
 * lookup here — document.getElementById can't see into shadow roots), and it
 * replaces that element with the iframe. The mount node is created manually
 * inside the static template container so the template engine never tries to
 * patch what YouTube replaced.
 */
@MelodicComponent({
  selector: 'td-youtube-player',
  template: youTubePlayerTemplate,
  styles: youTubePlayerStyles,
})
export class YouTubePlayerComponent {
  public elementRef!: HTMLElement

  public track = track
  public playing = playing
  public volume = volume
  public seekTo = seekTo

  private _player: YT.Player | null = null
  private _playerVideoId: string | null = null
  private _ready = false
  private _disposed = false
  private _appliedPlaying = false
  private _appliedVolume = -1
  private _lastSeekRequestId = 0
  private _progressTimer = 0

  public onCreate(): void {
    this._lastSeekRequestId = this.seekTo()?.requestId ?? 0
    this.ensurePlayer()
    this._progressTimer = window.setInterval(() => {
      if (!this._ready || !this._player) return
      reportProgress(this._player.getCurrentTime(), this._player.getDuration())
    }, 500)
  }

  public onRender(): void {
    if (!this.elementRef.isConnected) return
    this.ensurePlayer()
    this.syncPlayer()
  }

  public onDestroy(): void {
    this._disposed = true
    window.clearInterval(this._progressTimer)
    this.destroyPlayer()
  }

  /** (Re)creates the player when the on-screen track's video id changes. */
  private ensurePlayer(): void {
    const current = this.track()
    if (!current || current.id === this._playerVideoId) return
    this.destroyPlayer()
    this._playerVideoId = current.id

    const container = this.elementRef.shadowRoot?.querySelector('.youtube-player')
    if (!container) return
    const mount = document.createElement('div')
    container.appendChild(mount)

    const videoId = current.id
    // Cues the video to start here (e.g. resuming a saved position) instead of 0.
    const startSeconds = elapsedNow
    void loadIframeApi().then(() => {
      if (this._disposed || this._playerVideoId !== videoId || !mount.isConnected) return
      this._player = new window.YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          ...(startSeconds > 0 ? { start: Math.floor(startSeconds) } : {}),
          ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
            ? { origin: window.location.origin }
            : {}),
        },
        events: {
          onReady: (event) => {
            if (this._disposed) return
            this._ready = true
            this._appliedVolume = this.volume()
            event.target.setVolume(this._appliedVolume)
            this._appliedPlaying = this.playing()
            if (this._appliedPlaying) event.target.playVideo()
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              this._appliedPlaying = true
              this.playing.set(true)
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              this._appliedPlaying = false
              this.playing.set(false)
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              handleEnded()
            }
          },
          onError: () => markUnavailable(),
        },
      })
    })
  }

  /** Applies play/pause, volume, and pending seeks that changed since last render. */
  private syncPlayer(): void {
    if (!this._ready || !this._player) return

    const shouldPlay = this.playing()
    if (shouldPlay !== this._appliedPlaying) {
      this._appliedPlaying = shouldPlay
      if (shouldPlay) {
        this._player.playVideo()
      } else {
        this._player.pauseVideo()
      }
    }

    const currentVolume = this.volume()
    if (currentVolume !== this._appliedVolume) {
      this._appliedVolume = currentVolume
      this._player.setVolume(currentVolume)
    }

    const seek = this.seekTo()
    if (seek && seek.requestId !== this._lastSeekRequestId) {
      this._lastSeekRequestId = seek.requestId
      this._player.seekTo(seek.seconds, true)
      // Seeking an ended video (repeat-one) must resume playback.
      if (this.playing()) this._player.playVideo()
    }
  }

  private destroyPlayer(): void {
    this._player?.destroy()
    this._player = null
    this._playerVideoId = null
    this._ready = false
    this._appliedVolume = -1
    // YT.Player.destroy() restores the mount div; clear any leftovers.
    const container = this.elementRef.shadowRoot?.querySelector('.youtube-player')
    if (container) container.replaceChildren()
  }
}
