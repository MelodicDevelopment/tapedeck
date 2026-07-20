import {
  CircleOff,
  ListMusic,
  ListPlus,
  RefreshCcw,
  X,
  Youtube,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MediaControlEvent,
  onMediaControl,
  updateMediaMetadata,
  updateMediaPlayback,
  updatePlayerActive,
} from '../api/media'
import { formatTime, Playlist, thumbnailUrl, Track } from '../data/mockPlaylist'
import type { Mixtape } from '../lib/library'
import { Brand } from './Brand'
import { MixtapePicker } from './MixtapePicker'
import { PlaybackBar } from './PlaybackBar'
import { YouTubePlayer } from './YouTubePlayer'

type PlayerScreenProps = {
  playlist: Playlist
  mixtapes: Mixtape[]
  activeMixtapeId?: string | null
  onChangeSource: () => void
  onToggleMixtapeTrack: (mixtapeId: string, track: Track) => void
  onCreateMixtape: (name: string, track: Track) => void
}

export function PlayerScreen({
  playlist,
  mixtapes,
  activeMixtapeId,
  onChangeSource,
  onToggleMixtapeTrack,
  onCreateMixtape,
}: PlayerScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(playlist.tracks[0].duration)
  const [volume, setVolume] = useState(70)
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(new Set())
  const [seekTo, setSeekTo] = useState<{ seconds: number; requestId: number } | null>(null)
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null)

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
    updateMediaPlayback(playing, seconds)
  }

  const handleMediaControl = (event: MediaControlEvent) => {
    switch (event.action) {
      case 'play':
        if (!unavailable) setPlaying(true)
        break
      case 'pause':
        setPlaying(false)
        break
      case 'toggle':
        if (!unavailable) setPlaying((current) => !current)
        break
      case 'next':
        moveTrack(1)
        break
      case 'previous':
        moveTrack(-1)
        break
      case 'seek':
        handleSeek(Math.min(Math.max(event.value ?? 0, 0), duration))
        break
      case 'seekBy':
        handleSeek(Math.min(Math.max(elapsed + (event.value ?? 0), 0), duration))
        break
      case 'setVolume':
        setVolume(Math.min(Math.max(Math.round((event.value ?? 0) * 100), 0), 100))
        break
      case 'volumeUp':
        adjustVolume(6)
        break
      case 'volumeDown':
        adjustVolume(-6)
        break
      case 'toggleMute':
        toggleMute()
        break
    }
  }

  const adjustVolume = (delta: number) =>
    setVolume((current) => Math.min(Math.max(current + delta, 0), 100))

  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 70)
  if (volume > 0) lastAudibleVolumeRef.current = volume

  const toggleMute = () =>
    setVolume((current) => (current === 0 ? lastAudibleVolumeRef.current : 0))

  // Latest-state handlers behind stable refs so the subscriptions below are
  // registered once instead of churning on every render.
  const mediaControlRef = useRef(handleMediaControl)
  mediaControlRef.current = handleMediaControl
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const currentTrackIdRef = useRef(track?.id)
  currentTrackIdRef.current = track?.id

  // Mixtape edits replace the playlist prop mid-playback; keep following the
  // same track when it moves, and fall back gracefully when it was removed.
  useEffect(() => {
    const index = playlist.tracks.findIndex((entry) => entry.id === currentTrackIdRef.current)
    if (index === -1) {
      selectTrack(Math.max(0, Math.min(currentIndexRef.current, playlist.tracks.length - 1)))
    } else if (index !== currentIndexRef.current) {
      setCurrentIndex(index)
    }
  }, [playlist, selectTrack])

  useEffect(() => onMediaControl((event) => mediaControlRef.current(event)), [])

  useEffect(() => {
    updatePlayerActive(true)
    return () => updatePlayerActive(false)
  }, [])

  useEffect(() => {
    updateMediaMetadata({
      title: track.title,
      artist: track.artist,
      coverUrl: track.unavailable ? undefined : thumbnailUrl(track.id),
      durationSecs: duration > 0 ? duration : undefined,
    })
  }, [track, duration])

  useEffect(() => {
    updateMediaPlayback(playing && !unavailable, elapsedRef.current)
  }, [playing, unavailable, track.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        mediaControlRef.current({ action: 'toggle' })
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        adjustVolume(5)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        adjustVolume(-5)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
                <li key={item.id} className="track-item">
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
                  {!isUnavailable && (
                    activeMixtapeId ? (
                      <button
                        className="track-item__action"
                        onClick={() => onToggleMixtapeTrack(activeMixtapeId, item)}
                        aria-label={`Remove ${item.title} from this mixtape`}
                        title="Remove from mixtape"
                      >
                        <X aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        className="track-item__action"
                        onClick={() => setPickerTrack(item)}
                        aria-label={`Add ${item.title} to a mixtape`}
                        title="Add to mixtape"
                      >
                        <ListPlus aria-hidden="true" />
                      </button>
                    )
                  )}
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

      {pickerTrack && (
        <MixtapePicker
          track={pickerTrack}
          mixtapes={mixtapes}
          onToggle={onToggleMixtapeTrack}
          onCreate={onCreateMixtape}
          onClose={() => setPickerTrack(null)}
        />
      )}
    </main>
  )
}
