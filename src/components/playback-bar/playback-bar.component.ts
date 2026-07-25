import { MelodicComponent } from '@melodicdev/core'
import {
  cycleRepeat,
  duration,
  elapsed,
  moveTrack,
  playing,
  repeatMode,
  seek,
  shuffle,
  togglePlay,
  toggleShuffle,
  track,
  unavailable,
  volume,
} from '../../store/player'
import { playbackBarTemplate } from './playback-bar.template'
import { playbackBarStyles } from './playback-bar.styles'

/**
 * td-playback-bar — the transport bar: now-playing summary, shuffle/repeat,
 * previous/play/next, seek slider, and volume.
 */
@MelodicComponent({
  selector: 'td-playback-bar',
  template: playbackBarTemplate,
  styles: playbackBarStyles,
})
export class PlaybackBarComponent {
  public track = track
  public playing = playing
  public unavailable = unavailable
  public elapsed = elapsed
  public duration = duration
  public volume = volume
  public shuffle = shuffle
  public repeatMode = repeatMode

  public previous(): void {
    moveTrack(-1)
  }

  public toggle(): void {
    togglePlay()
  }

  public next(): void {
    moveTrack(1)
  }

  public onToggleShuffle(): void {
    toggleShuffle()
  }

  public onCycleRepeat(): void {
    cycleRepeat()
  }

  public onSeek(event: Event): void {
    seek(Number((event.target as HTMLInputElement).value))
  }

  public onVolumeInput(event: Event): void {
    this.volume.set(Number((event.target as HTMLInputElement).value))
  }

  public toggleMute(): void {
    this.volume.set(this.volume() === 0 ? 70 : 0)
  }
}
