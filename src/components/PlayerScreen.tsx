import {
  CircleOff,
  ListMusic,
  RefreshCcw,
  Youtube,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { formatTime, Playlist, thumbnailUrl } from '../data/mockPlaylist'
import { Brand } from './Brand'
import { PlaybackBar } from './PlaybackBar'
import { YouTubePlayer } from './YouTubePlayer'

type PlayerScreenProps = {
  playlist: Playlist
  onChangeSource: () => void
}

export function PlayerScreen({ playlist, onChangeSource }: PlayerScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(playlist.tracks[0].duration)
  const [volume, setVolume] = useState(70)
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(new Set())
  const [seekTo, setSeekTo] = useState<{ seconds: number; requestId: number } | null>(null)

  const track = playlist.tracks[currentIndex]
  const unavailable = Boolean(track.unavailable || failedVideoIds.has(track.id))

  const selectTrack = useCallback((index: number) => {
    const nextTrack = playlist.tracks[index]
    setCurrentIndex(index)
    setElapsed(0)
    setDuration(nextTrack.duration)
    setPlaying(!nextTrack.unavailable)
  }, [playlist.tracks])

  const moveTrack = useCallback(
    (direction: number) => {
      const count = playlist.tracks.length
      selectTrack((currentIndex + direction + count) % count)
    },
    [currentIndex, playlist.tracks.length, selectTrack],
  )

  const handleUnavailable = useCallback(() => {
    setFailedVideoIds((current) => new Set(current).add(track.id))
    setPlaying(false)
    setElapsed(0)
  }, [track.id])

  function handleSeek(seconds: number) {
    if (unavailable) return
    setElapsed(seconds)
    setSeekTo((current) => ({ seconds, requestId: (current?.requestId ?? 0) + 1 }))
  }

  return (
    <main className="loaded-shell">
      <div className="player-workspace">
        <aside className="queue-panel" aria-label="Video queue">
          <div className="source-card">
            <img className="source-card__art" src={playlist.thumbnail || thumbnailUrl(playlist.tracks[0].id)} alt="" />
            <div className="source-card__copy">
              <strong>{playlist.name}</strong>
              <span>{playlist.kind} · {playlist.tracks.length} videos</span>
            </div>
            <button
              className="source-card__change"
              onClick={onChangeSource}
              aria-label="Load a different YouTube URL"
              title="Load a different URL"
            >
              <RefreshCcw aria-hidden="true" />
            </button>
          </div>

          <div className="queue-heading">
            <span><ListMusic aria-hidden="true" /> Up next</span>
            <span>{playlist.tracks.length} tracks</span>
          </div>

          <ol className="track-list" aria-label="Tracks">
            {playlist.tracks.map((item, index) => {
              const isCurrent = index === currentIndex
              const isUnavailable = Boolean(item.unavailable || failedVideoIds.has(item.id))
              return (
                <li key={item.id}>
                  <button
                    className={`track-row${isCurrent ? ' track-row--current' : ''}`}
                    onClick={() => selectTrack(index)}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span className="track-row__thumb">
                      {!item.unavailable && <img src={thumbnailUrl(item.id)} alt="" loading="lazy" />}
                      {isCurrent && !isUnavailable && (
                        <span
                          className={`playing-bars${playing ? ' playing-bars--active' : ''}`}
                          aria-label={playing ? 'Currently playing' : 'Selected'}
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                    </span>
                    <span className="track-row__copy">
                      <strong className={isUnavailable ? 'muted' : undefined}>{item.title}</strong>
                      <span>{isUnavailable ? 'Unavailable on YouTube' : item.artist}</span>
                    </span>
                    <time>{formatTime(item.duration)}</time>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="player-panel" aria-label="Now playing">
          <header className="player-header">
            <Brand compact />
            <span className="youtube-source">
              <Youtube aria-hidden="true" />
              Streaming from YouTube
            </span>
          </header>

          <div className="player-stage">
            <div className={`video-frame${unavailable ? ' video-frame--unavailable' : ''}`}>
              {unavailable ? (
                <div className="unavailable-state" role="status">
                  <CircleOff aria-hidden="true" />
                  <h2>This video is unavailable</h2>
                  <p>It may be private or removed on YouTube. You can skip it and keep listening.</p>
                  <button className="button button--primary button--small" onClick={() => moveTrack(1)}>
                    Skip to next
                  </button>
                </div>
              ) : (
                <YouTubePlayer
                  key={track.id}
                  videoId={track.id}
                  playing={playing}
                  volume={volume}
                  seekTo={seekTo}
                  onPlayingChange={setPlaying}
                  onProgress={(nextElapsed, nextDuration) => {
                    setElapsed(nextElapsed)
                    if (nextDuration > 0) setDuration(nextDuration)
                  }}
                  onEnded={() => moveTrack(1)}
                  onUnavailable={handleUnavailable}
                />
              )}
            </div>

            <div className="track-details">
              <div>
                <p className="track-details__label">NOW PLAYING</p>
                <h1>{track.title}</h1>
                <p>{track.artist} <span aria-hidden="true">·</span> YouTube video</p>
              </div>
              <span>Track {currentIndex + 1} of {playlist.tracks.length}</span>
            </div>
          </div>
        </section>
      </div>

      <PlaybackBar
        track={track}
        playing={playing}
        unavailable={unavailable}
        elapsed={elapsed}
        duration={duration}
        volume={volume}
        onPrevious={() => moveTrack(-1)}
        onToggle={() => !unavailable && setPlaying((current) => !current)}
        onNext={() => moveTrack(1)}
        onSeek={handleSeek}
        onVolumeChange={setVolume}
      />
    </main>
  )
}
