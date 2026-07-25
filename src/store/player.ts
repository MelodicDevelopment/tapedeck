import { computed, signal } from '@melodicdev/core'
import { type MediaControlEvent, updateMediaPlayback } from '../api/media'
import type { Track } from '../data/mockPlaylist'
import {
  advanceIndex,
  nextRepeatMode,
  sequentialOrder,
  shuffledOrder,
  type RepeatMode,
} from '../lib/playback'
import { activePlaylist, library } from './state'

/** Playback state. In the React build this lived inside PlayerScreen and was
 *  reset by remounting on a source change; here `initPlayback()` is that reset. */
export const currentIndex = signal(0)
export const playing = signal(false)
export const elapsed = signal(0)
export const duration = signal(0)
export const volume = signal(70)
export const failedVideoIds = signal<ReadonlySet<string>>(new Set())
export const seekTo = signal<{ seconds: number; requestId: number } | null>(null)
export const pickerTrack = signal<Track | null>(null)
export const shuffle = signal(false)
export const repeatMode = signal<RepeatMode>('off')
export const shortcutsOpen = signal(false)
export const mode = signal<'video' | 'audio'>('video')

/** Set when the user clicks a related video inside the embedded YouTube
 *  player itself (its "More videos" overlay, end screens) — plays inline
 *  without disturbing the actual queue position, which resumes on return. */
export const externalVideo = signal<Track | null>(null)
export const externalVideoLoading = signal(false)

/** Plain mirror of `elapsed` for reads inside SignalEffects that must not
 *  subscribe to the 500ms progress tick (the React build used a ref). */
export let elapsedNow = 0
export function setElapsed(seconds: number): void {
  elapsedNow = seconds
  elapsed.set(seconds)
}

let shuffleOrder: number[] = []
let savedQueueState: { elapsed: number; playing: boolean } | null = null

/** Whatever is on screen: an inline external video, else the queue track. */
export const track = computed<Track | null>(() => {
  const external = externalVideo()
  if (external) return external
  return activePlaylist()?.tracks[currentIndex()] ?? null
})

export const unavailable = computed(() => {
  const current = track()
  return Boolean(current && (current.unavailable || failedVideoIds().has(current.id)))
})

/** The real queue track's id — deliberately NOT `track()`, which reflects
 *  whatever's on screen (including an external video override); playlist
 *  syncing and progress persistence must always track the actual queue. */
export const queueTrackId = computed(() => activePlaylist()?.tracks[currentIndex()]?.id)

export function regenerateShuffleOrder(): void {
  shuffleOrder = shuffledOrder(activePlaylist()?.tracks.length ?? 0, currentIndex())
}

export function selectTrack(index: number): void {
  const next = activePlaylist()?.tracks[index]
  if (!next) return
  externalVideo.set(null)
  savedQueueState = null
  currentIndex.set(index)
  setElapsed(0)
  duration.set(next.duration)
  playing.set(!next.unavailable)
}

export function returnToQueue(): void {
  const saved = savedQueueState
  savedQueueState = null
  externalVideo.set(null)
  setElapsed(saved?.elapsed ?? 0)
  duration.set(activePlaylist()?.tracks[currentIndex()]?.duration ?? 0)
  playing.set(saved?.playing ?? true)
}

/** Remembers queue position/playing once, before the first external video
 *  takes over the stage; `returnToQueue()` restores it. */
export function saveQueueStateOnce(): void {
  savedQueueState ??= { elapsed: elapsedNow, playing: playing() }
}

export function showExternalVideo(resolved: Track): void {
  externalVideo.set(resolved)
  setElapsed(0)
  duration.set(resolved.duration)
  playing.set(!resolved.unavailable)
}

function isPlayable(index: number): boolean {
  const entry = activePlaylist()?.tracks[index]
  return Boolean(entry) && !entry?.unavailable && !failedVideoIds().has(entry?.id ?? '')
}

export function moveTrack(direction: 1 | -1, wrap = true): void {
  const count = activePlaylist()?.tracks.length ?? 0
  const order = shuffle() ? shuffleOrder : sequentialOrder(count)
  const next = advanceIndex(order, currentIndex(), direction, wrap, isPlayable)
  if (next === null) {
    playing.set(false)
    return
  }
  selectTrack(next)
}

export function handleEnded(): void {
  if (repeatMode() === 'one') {
    seek(0)
    return
  }
  moveTrack(1, repeatMode() === 'all')
}

export function markUnavailable(): void {
  const current = track()
  if (!current) return
  const next = new Set(failedVideoIds())
  next.add(current.id)
  failedVideoIds.set(next)
  playing.set(false)
  setElapsed(0)
}

/** Progress tick from the embedded player (every 500ms while mounted). */
export function reportProgress(elapsedSecs: number, durationSecs: number): void {
  setElapsed(elapsedSecs)
  if (durationSecs > 0) duration.set(durationSecs)
}

export function seek(seconds: number): void {
  if (unavailable()) return
  setElapsed(seconds)
  seekTo.update((current) => ({ seconds, requestId: (current?.requestId ?? 0) + 1 }))
  updateMediaPlayback(playing(), seconds)
}

export function togglePlay(): void {
  if (!unavailable()) playing.update((current) => !current)
}

export function adjustVolume(delta: number): void {
  volume.update((current) => Math.min(Math.max(current + delta, 0), 100))
}

export function toggleShuffle(): void {
  shuffle.update((current) => !current)
  if (shuffle()) regenerateShuffleOrder()
}

export function cycleRepeat(): void {
  repeatMode.update(nextRepeatMode)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function handleMediaControl(event: MediaControlEvent): void {
  switch (event.action) {
    case 'play':
      if (!unavailable()) playing.set(true)
      break
    case 'pause':
      playing.set(false)
      break
    case 'toggle':
      togglePlay()
      break
    case 'next':
      moveTrack(1)
      break
    case 'previous':
      moveTrack(-1)
      break
    case 'seek':
      seek(clamp(event.value ?? 0, 0, duration()))
      break
    case 'seekBy':
      seek(clamp(elapsedNow + (event.value ?? 0), 0, duration()))
      break
    case 'setVolume':
      volume.set(clamp(Math.round((event.value ?? 0) * 100), 0, 100))
      break
  }
}

/**
 * Full playback reset for a newly-activated source or mixtape — the moral
 * equivalent of React remounting PlayerScreen via key={sourceUrl}. A saved
 * position resumes at that track/time; otherwise start at the top.
 */
export function initPlayback(resumeTrackId?: string, resumePositionSecs?: number): void {
  const active = activePlaylist()
  if (!active || active.tracks.length === 0) return
  const settings = library().playbackSettings

  const resumeIndex = resumeTrackId
    ? active.tracks.findIndex((entry) => entry.id === resumeTrackId)
    : -1
  const startIndex = resumeIndex >= 0 ? resumeIndex : 0
  const startTrack = active.tracks[startIndex]

  externalVideo.set(null)
  externalVideoLoading.set(false)
  savedQueueState = null
  failedVideoIds.set(new Set())
  seekTo.set(null)
  pickerTrack.set(null)
  shortcutsOpen.set(false)
  mode.set('video')

  currentIndex.set(startIndex)
  setElapsed(resumeIndex >= 0 ? resumePositionSecs ?? 0 : 0)
  duration.set(startTrack?.duration ?? 0)
  // Loading a source is an explicit "play this" action, so start right away.
  playing.set(!startTrack?.unavailable)

  volume.set(settings.volume)
  shuffle.set(settings.shuffle)
  repeatMode.set(settings.repeatMode)
  if (settings.shuffle) regenerateShuffleOrder()
}

/**
 * Mixtape edits replace the active playlist mid-playback; keep following the
 * same track when it moves, and fall back gracefully when it was removed.
 * `previousTrackId` is the queue track id captured before the edit.
 */
export function syncWithPlaylist(previousTrackId: string | undefined): void {
  const active = activePlaylist()
  if (!active || active.tracks.length === 0) return
  const index = previousTrackId
    ? active.tracks.findIndex((entry) => entry.id === previousTrackId)
    : -1
  if (index === -1) {
    selectTrack(Math.max(0, Math.min(currentIndex(), active.tracks.length - 1)))
  } else if (index !== currentIndex()) {
    currentIndex.set(index)
  }
  if (shuffle()) regenerateShuffleOrder()
}
