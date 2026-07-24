import {
  ArrowLeft,
  CircleOff,
  GripVertical,
  HelpCircle,
  ListMusic,
  ListPlus,
  LoaderCircle,
  Music,
  Target,
  Video,
  X,
  Youtube,
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isDesktopApp, type AuthStatus } from '../api/auth'
import {
  MediaControlEvent,
  onMediaControl,
  updateMediaMetadata,
  updateMediaPlayback,
} from '../api/media'
import { resolveVideo } from '../api/youtube'
import { formatTime, Playlist, thumbnailUrl, Track } from '../data/mockPlaylist'
import type { Mixtape, PlaybackSettings, SavedSource } from '../lib/library'
import {
  advanceIndex,
  nextRepeatMode,
  sequentialOrder,
  shuffledOrder,
  type RepeatMode,
} from '../lib/playback'
import { parseVolumeBadge } from '../lib/trackTitle'
import { AccountSummary } from './AccountSummary'
import { Brand } from './Brand'
import { MixtapePicker } from './MixtapePicker'
import { PlaybackBar } from './PlaybackBar'
import { ShortcutsModal } from './ShortcutsModal'
import { SourceSwitcher } from './SourceSwitcher'
import { YouTubePlayer } from './YouTubePlayer'

type PlayerScreenProps = {
  playlist: Playlist
  mixtapes: Mixtape[]
  sources: SavedSource[]
  activeMixtapeId?: string | null
  authStatus: AuthStatus | null
  authAction: 'sign-in' | 'sign-out' | null
  initialShuffle: boolean
  initialRepeatMode: RepeatMode
  initialVolume: number
  initialResumeTrackId?: string
  initialResumePositionSecs?: number
  onChangeSource: () => void
  onSelectSource: (url: string) => void
  onSelectMixtape: (mixtapeId: string) => void
  onToggleMixtapeTrack: (mixtapeId: string, track: Track) => void
  onReorderMixtapeTrack: (mixtapeId: string, fromIndex: number, toIndex: number) => void
  onCreateMixtape: (name: string, track: Track) => void
  onPlaybackSettingsChange: (settings: PlaybackSettings) => void
  onPlaybackProgress: (trackId: string, positionSecs: number) => void
  onSignOut: () => void
}

export function PlayerScreen({
  playlist,
  mixtapes,
  sources,
  activeMixtapeId,
  authStatus,
  authAction,
  initialShuffle,
  initialRepeatMode,
  initialVolume,
  initialResumeTrackId,
  initialResumePositionSecs,
  onChangeSource,
  onSelectSource,
  onSelectMixtape,
  onToggleMixtapeTrack,
  onReorderMixtapeTrack,
  onCreateMixtape,
  onPlaybackSettingsChange,
  onPlaybackProgress,
  onSignOut,
}: PlayerScreenProps) {
  // A saved position resumes at that track/time; otherwise start at the top.
  const resumeIndex = initialResumeTrackId
    ? playlist.tracks.findIndex((entry) => entry.id === initialResumeTrackId)
    : -1
  const startIndex = resumeIndex >= 0 ? resumeIndex : 0
  const startElapsed = resumeIndex >= 0 ? (initialResumePositionSecs ?? 0) : 0

  const [currentIndex, setCurrentIndex] = useState(startIndex)
  // Loading a source is an explicit "play this" action, so start right away.
  const [playing, setPlaying] = useState(!playlist.tracks[startIndex].unavailable)
  const [elapsed, setElapsed] = useState(startElapsed)
  const [duration, setDuration] = useState(playlist.tracks[startIndex].duration)
  const [volume, setVolume] = useState(initialVolume)
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(new Set())
  const [seekTo, setSeekTo] = useState<{ seconds: number; requestId: number } | null>(null)
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null)
  const [shuffle, setShuffle] = useState(initialShuffle)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(initialRepeatMode)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mode, setMode] = useState<'video' | 'audio'>('video')
  // Set when the user clicks a related video inside the embedded YouTube
  // player itself (its "More videos" overlay, end screens) — plays inline
  // without disturbing the actual queue position, which resumes on return.
  const [externalVideo, setExternalVideo] = useState<Track | null>(null)
  const [externalVideoLoading, setExternalVideoLoading] = useState(false)
  const shuffleOrderRef = useRef<number[]>([])
  const trackListRef = useRef<HTMLOListElement | null>(null)
  const savedQueueStateRef = useRef<{ elapsed: number; playing: boolean } | null>(null)

  const track = externalVideo ?? playlist.tracks[currentIndex]
  const unavailable = Boolean(track.unavailable || failedVideoIds.has(track.id))
  // Nothing to show in audio mode when the track can't play at all — fall
  // back to the video frame's own unavailable-state message.
  const showAudioMode = mode === 'audio' && !unavailable
  const watchUrl = `https://www.youtube.com/watch?v=${track.id}`
  const channelUrl = playlist.sourceUrl.startsWith('http') ? playlist.sourceUrl : null

  const selectTrack = useCallback((index: number) => {
    const nextTrack = playlist.tracks[index]
    setExternalVideo(null)
    savedQueueStateRef.current = null
    setCurrentIndex(index)
    setElapsed(0)
    setDuration(nextTrack.duration)
    setPlaying(!nextTrack.unavailable)
  }, [playlist.tracks])

  function returnToQueue() {
    const saved = savedQueueStateRef.current
    savedQueueStateRef.current = null
    setExternalVideo(null)
    setElapsed(saved?.elapsed ?? 0)
    setDuration(playlist.tracks[currentIndex].duration)
    setPlaying(saved?.playing ?? true)
  }

  const isPlayable = useCallback(
    (index: number) => {
      const entry = playlist.tracks[index]
      return Boolean(entry) && !entry.unavailable && !failedVideoIds.has(entry.id)
    },
    [playlist.tracks, failedVideoIds],
  )

  const moveTrack = useCallback(
    (direction: 1 | -1, wrap = true) => {
      const order = shuffle ? shuffleOrderRef.current : sequentialOrder(playlist.tracks.length)
      const next = advanceIndex(order, currentIndex, direction, wrap, isPlayable)
      if (next === null) {
        setPlaying(false)
        return
      }
      selectTrack(next)
    },
    [shuffle, playlist.tracks.length, currentIndex, isPlayable, selectTrack],
  )

  function handleEnded() {
    if (repeatMode === 'one') {
      handleSeek(0)
      return
    }
    moveTrack(1, repeatMode === 'all')
  }

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
    }
  }

  const adjustVolume = (delta: number) =>
    setVolume((current) => Math.min(Math.max(current + delta, 0), 100))

  // Latest-state handlers behind stable refs so the subscriptions below are
  // registered once instead of churning on every render.
  const mediaControlRef = useRef(handleMediaControl)
  mediaControlRef.current = handleMediaControl
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed
  const playingRef = useRef(playing)
  playingRef.current = playing
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  // The real queue track's id — deliberately NOT `track.id`, which reflects
  // whatever's on screen (including an external video override); playlist
  // syncing and progress persistence must always track the actual queue.
  const currentTrackIdRef = useRef(playlist.tracks[currentIndex]?.id)
  currentTrackIdRef.current = playlist.tracks[currentIndex]?.id

  // A related-video click inside the embedded YouTube player itself (its
  // "More videos" overlay, end screens) reaches here via a Tauri event —
  // see the `on_new_window` hook in src-tauri/src/lib.rs, which resolves
  // the destination URL to a video id instead of just opening a browser tab.
  useEffect(() => {
    if (!isDesktopApp()) return
    let active = true
    const unlisten = listen<string>('tapedeck://play-external-video', (event) => {
      const videoId = event.payload
      if (!active) return
      savedQueueStateRef.current ??= { elapsed: elapsedRef.current, playing: playingRef.current }
      setExternalVideoLoading(true)
      resolveVideo(videoId)
        .then((resolved) => {
          if (!active) return
          setExternalVideo(resolved)
          setElapsed(0)
          setDuration(resolved.duration)
          setPlaying(!resolved.unavailable)
        })
        .catch(() => {})
        .finally(() => {
          if (active) setExternalVideoLoading(false)
        })
    })
    return () => {
      active = false
      unlisten.then((fn) => fn())
    }
  }, [])

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

  // A fresh shuffle order whenever shuffle turns on or the playlist changes,
  // keeping the current track as the starting point.
  useEffect(() => {
    if (shuffle) {
      shuffleOrderRef.current = shuffledOrder(playlist.tracks.length, currentIndexRef.current)
    }
  }, [shuffle, playlist])

  // Debounced so dragging the volume slider doesn't write to disk on every
  // tick; shuffle/repeat toggle rarely enough that the same short delay is
  // unnoticeable there too.
  useEffect(() => {
    const timeout = setTimeout(() => {
      onPlaybackSettingsChange({ shuffle, repeatMode, volume })
    }, 400)
    return () => clearTimeout(timeout)
  }, [shuffle, repeatMode, volume, onPlaybackSettingsChange])

  // Checkpoints the resume position periodically (elapsed ticks every 500ms
  // while playing, so this can't be a simple debounce on elapsed itself —
  // it would never settle) and once more on unmount, so switching away or
  // closing the app doesn't lose more than a few seconds of progress.
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTrackIdRef.current) onPlaybackProgress(currentTrackIdRef.current, elapsedRef.current)
    }, 15000)
    return () => {
      clearInterval(interval)
      if (currentTrackIdRef.current) onPlaybackProgress(currentTrackIdRef.current, elapsedRef.current)
    }
  }, [onPlaybackProgress])

  // Centers the current track's row in the queue list. Scrolls only the
  // list itself so the rest of the layout never jumps.
  const scrollToCurrent = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const list = trackListRef.current
    if (!list || typeof list.scrollTo !== 'function') return
    const row = list.querySelector('[aria-current="true"]')?.closest('li')
    if (!row) return
    const listRect = list.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const delta = rowRect.top - listRect.top - (list.clientHeight - rowRect.height) / 2
    list.scrollTo({ top: list.scrollTop + delta, behavior })
  }, [])

  // Keep the queue following the active song automatically too.
  useEffect(() => {
    scrollToCurrent()
  }, [currentIndex, playlist, scrollToCurrent])

  useEffect(() => onMediaControl((event) => mediaControlRef.current(event)), [])

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
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        mediaControlRef.current({ action: 'next' })
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        mediaControlRef.current({ action: 'previous' })
      } else if (event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        setShuffle((current) => !current)
      } else if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleTrackDrop(index: number) {
    if (activeMixtapeId && dragIndex !== null && dragIndex !== index) {
      onReorderMixtapeTrack(activeMixtapeId, dragIndex, index)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <main className="loaded-shell">
      <div className="player-workspace">
        <aside className="queue-panel" aria-label="Video queue">
          <SourceSwitcher
            playlist={playlist}
            mixtapes={mixtapes}
            sources={sources}
            activeMixtapeId={activeMixtapeId}
            onSelectSource={onSelectSource}
            onSelectMixtape={onSelectMixtape}
            onChangeSource={onChangeSource}
          />

          <div className="queue-heading">
            <span><ListMusic aria-hidden="true" /> Up next</span>
            <button
              type="button"
              className="queue-heading__jump"
              onClick={() => scrollToCurrent()}
              aria-label="Scroll to the current track"
              title="Scroll to the current track"
            >
              <Target aria-hidden="true" /> {playlist.tracks.length} tracks
            </button>
          </div>

          <ol className="track-list" aria-label="Tracks" ref={trackListRef}>
            {playlist.tracks.map((item, index) => {
              const isCurrent = index === currentIndex
              const isUnavailable = Boolean(item.unavailable || failedVideoIds.has(item.id))
              const reorderable = Boolean(activeMixtapeId)
              const badge = parseVolumeBadge(item.title)
              return (
                <li
                  key={item.id}
                  className={`track-item${reorderable && dragOverIndex === index ? ' track-item--drag-over' : ''}`}
                  draggable={reorderable}
                  onDragStart={reorderable ? () => setDragIndex(index) : undefined}
                  onDragOver={
                    reorderable
                      ? (event) => {
                          event.preventDefault()
                          setDragOverIndex(index)
                        }
                      : undefined
                  }
                  onDragLeave={reorderable ? () => setDragOverIndex((current) => (current === index ? null : current)) : undefined}
                  onDrop={
                    reorderable
                      ? (event) => {
                          event.preventDefault()
                          handleTrackDrop(index)
                        }
                      : undefined
                  }
                  onDragEnd={reorderable ? () => { setDragIndex(null); setDragOverIndex(null) } : undefined}
                >
                  {reorderable && (
                    <span className="track-item__grip" aria-hidden="true">
                      <GripVertical />
                    </span>
                  )}
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
                      <strong className={isUnavailable ? 'muted' : undefined}>
                        {badge && (
                          <span className={`track-row__badge${isCurrent ? ' track-row__badge--current' : ''}`}>
                            {badge.badge}
                          </span>
                        )}
                        {badge?.rest ?? item.title}
                      </strong>
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
            <div className="player-header__left">
              <Brand compact />
              <button
                type="button"
                className="player-header__back"
                onClick={onChangeSource}
                aria-label="Back to your library"
                title="Back to your library"
              >
                <ArrowLeft aria-hidden="true" /> Library
              </button>
            </div>

            <div className="mode-toggle" role="group" aria-label="Playback mode">
              <button
                type="button"
                className={`mode-toggle__option${mode === 'video' ? ' mode-toggle__option--active' : ''}`}
                onClick={() => setMode('video')}
                aria-pressed={mode === 'video'}
              >
                <Video aria-hidden="true" /> Video
              </button>
              <button
                type="button"
                className={`mode-toggle__option${mode === 'audio' ? ' mode-toggle__option--active' : ''}`}
                onClick={() => setMode('audio')}
                aria-pressed={mode === 'audio'}
              >
                <Music aria-hidden="true" /> Audio
              </button>
            </div>

            <div className="player-header__right">
              <span className="youtube-source">
                <Youtube aria-hidden="true" />
                Streaming from YouTube
              </span>
              <button
                type="button"
                className="player-header__icon-button"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
              >
                <HelpCircle aria-hidden="true" />
              </button>
              <AccountSummary authStatus={authStatus} authAction={authAction} onSignOut={onSignOut} />
            </div>
          </header>

          <div className="player-stage">
            {showAudioMode && (
              <div className="audio-mode">
                <div className="audio-mode__art">
                  <img src={thumbnailUrl(track.id)} alt="" />
                  <span className={`audio-mode__reel${playing ? ' audio-mode__reel--spinning' : ''}`} aria-hidden="true">
                    <span className="audio-mode__reel-ring" />
                    <span className="audio-mode__reel-hub" />
                  </span>
                </div>
                <div className="audio-mode__copy">
                  {externalVideo ? (
                    <button type="button" className="track-details__back-to-queue" onClick={returnToQueue}>
                      <ArrowLeft aria-hidden="true" /> Back to queue
                    </button>
                  ) : (
                    <p className="track-details__label">
                      NOW PLAYING
                      {externalVideoLoading && <LoaderCircle className="track-details__loading spin" aria-hidden="true" />}
                    </p>
                  )}
                  <h1>
                    {unavailable ? (
                      track.title
                    ) : (
                      <a href={watchUrl} target="_blank" rel="noreferrer">
                        {track.title}
                      </a>
                    )}
                  </h1>
                  <p>
                    {channelUrl ? (
                      <a href={channelUrl} target="_blank" rel="noreferrer">
                        {track.artist}
                      </a>
                    ) : (
                      track.artist
                    )}{' '}
                    <span aria-hidden="true">·</span> {formatTime(track.duration)}
                  </p>
                  <button type="button" className="audio-mode__show-video" onClick={() => setMode('video')}>
                    <img src={thumbnailUrl(track.id)} alt="" /> Show video
                  </button>
                </div>
              </div>
            )}

            <div
              className={`video-frame${unavailable ? ' video-frame--unavailable' : ''}${showAudioMode ? ' video-frame--hidden' : ''}`}
            >
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
                  startSeconds={elapsed}
                  onPlayingChange={setPlaying}
                  onProgress={(nextElapsed, nextDuration) => {
                    setElapsed(nextElapsed)
                    if (nextDuration > 0) setDuration(nextDuration)
                  }}
                  onEnded={handleEnded}
                  onUnavailable={handleUnavailable}
                />
              )}
            </div>

            {!showAudioMode && (
              <div className="track-details">
                <div>
                  {externalVideo ? (
                    <button type="button" className="track-details__back-to-queue" onClick={returnToQueue}>
                      <ArrowLeft aria-hidden="true" /> Back to queue
                    </button>
                  ) : (
                    <p className="track-details__label">
                      NOW PLAYING
                      {externalVideoLoading && <LoaderCircle className="track-details__loading spin" aria-hidden="true" />}
                    </p>
                  )}
                  <h1>
                    {unavailable ? (
                      track.title
                    ) : (
                      <a href={watchUrl} target="_blank" rel="noreferrer">
                        {track.title}
                      </a>
                    )}
                  </h1>
                  <p className="track-details__meta">
                    {channelUrl ? (
                      <a href={channelUrl} target="_blank" rel="noreferrer">
                        {track.artist}
                      </a>
                    ) : (
                      track.artist
                    )}{' '}
                    <span aria-hidden="true">·</span> YouTube video
                  </p>
                </div>
                <button type="button" className="track-details__jump" onClick={() => scrollToCurrent()}>
                  Track {currentIndex + 1} of {playlist.tracks.length}
                </button>
              </div>
            )}
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
        shuffle={shuffle}
        repeatMode={repeatMode}
        onPrevious={() => moveTrack(-1)}
        onToggle={() => !unavailable && setPlaying((current) => !current)}
        onNext={() => moveTrack(1)}
        onToggleShuffle={() => setShuffle((current) => !current)}
        onCycleRepeat={() => setRepeatMode(nextRepeatMode)}
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

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </main>
  )
}
