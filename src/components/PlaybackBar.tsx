import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { CSSProperties } from 'react'
import { formatTime, thumbnailUrl, Track } from '../data/mockPlaylist'
import type { RepeatMode } from '../lib/playback'

type PlaybackBarProps = {
  track: Track
  playing: boolean
  unavailable: boolean
  elapsed: number
  duration: number
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
  onPrevious: () => void
  onToggle: () => void
  onNext: () => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  onSeek: (seconds: number) => void
  onVolumeChange: (volume: number) => void
}

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: 'Repeat the whole playlist',
  all: 'Repeat the current song',
  one: 'Turn repeat off',
}

export function PlaybackBar({
  track,
  playing,
  unavailable,
  elapsed,
  duration,
  volume,
  shuffle,
  repeatMode,
  onPrevious,
  onToggle,
  onNext,
  onToggleShuffle,
  onCycleRepeat,
  onSeek,
  onVolumeChange,
}: PlaybackBarProps) {
  const progress = duration ? Math.min(100, (elapsed / duration) * 100) : 0
  const rangeStyle = { '--range-progress': `${progress}%` } as CSSProperties
  const volumeStyle = { '--range-progress': `${volume}%` } as CSSProperties
  const VolumeIcon = volume === 0 ? VolumeX : volume < 55 ? Volume1 : Volume2

  return (
    <footer className="playback-bar" aria-label="Playback controls">
      <div className="now-playing">
        {track.unavailable ? (
          <span className="now-playing__thumb" aria-hidden="true" />
        ) : (
          <img src={thumbnailUrl(track.id)} alt="" />
        )}
        <div className="now-playing__text">
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>
      </div>

      <div className="playback-center">
        <div className="transport-controls">
          <button
            className={`icon-button icon-button--mode${shuffle ? ' icon-button--on' : ''}`}
            onClick={onToggleShuffle}
            aria-label={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
            aria-pressed={shuffle}
            title="Shuffle"
          >
            <Shuffle aria-hidden="true" />
          </button>
          <button className="icon-button" onClick={onPrevious} aria-label="Previous track">
            <SkipBack aria-hidden="true" />
          </button>
          <button
            className="play-button"
            onClick={onToggle}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={unavailable}
          >
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button className="icon-button" onClick={onNext} aria-label="Next track">
            <SkipForward aria-hidden="true" />
          </button>
          <button
            className={`icon-button icon-button--mode${repeatMode !== 'off' ? ' icon-button--on' : ''}`}
            onClick={onCycleRepeat}
            aria-label={REPEAT_LABELS[repeatMode]}
            title={repeatMode === 'one' ? 'Repeating this song' : repeatMode === 'all' ? 'Repeating playlist' : 'Repeat'}
          >
            {repeatMode === 'one' ? <Repeat1 aria-hidden="true" /> : <Repeat aria-hidden="true" />}
          </button>
        </div>

        <div className="progress-control">
          <time>{formatTime(unavailable ? 0 : elapsed)}</time>
          <input
            className="range range--progress"
            type="range"
            min="0"
            max={Math.max(duration, 1)}
            step="1"
            value={unavailable ? 0 : Math.min(elapsed, duration)}
            onChange={(event) => onSeek(Number(event.target.value))}
            style={rangeStyle}
            aria-label="Seek through current video"
            disabled={unavailable}
          />
          <time>-{formatTime(Math.max(0, duration - elapsed))}</time>
        </div>
      </div>

      <div className="volume-control">
        <button
          className="volume-control__button"
          aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          onClick={() => onVolumeChange(volume === 0 ? 70 : 0)}
        >
          <VolumeIcon aria-hidden="true" />
        </button>
        <input
          className="range"
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          style={volumeStyle}
          aria-label="Volume"
        />
      </div>
    </footer>
  )
}
