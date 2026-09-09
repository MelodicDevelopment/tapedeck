import { MelodicComponent } from '@melodicdev/core'
import type { Playlist, Track } from '../../data/mockPlaylist'
import {
  addVideoToMixtape,
  changeSource,
  convertSourceToMixtape,
  hideSourceTrack,
  reorderMixtapeTrack,
  toggleMixtapeTrack,
  unhideSourceTrack,
} from '../../store/actions'
import {
  currentIndex,
  externalVideo,
  externalVideoLoading,
  failedVideoIds,
  mode,
  moveTrack,
  pickerTrack,
  playing,
  returnToQueue,
  selectTrack,
  shortcutsOpen,
  track,
  unavailable,
} from '../../store/player'
import { activePlaylist, authAction, authStatus, hiddenTracks, playingMixtapeId } from '../../store/state'
import { playerScreenTemplate } from './player-screen.template'
import { playerScreenStyles } from './player-screen.styles'

/**
 * td-player-screen — the main playback workspace: queue panel with the
 * source switcher and track list, the video/audio stage, and the playback
 * bar. Modals (mixtape picker, shortcuts) render on top when open.
 */
@MelodicComponent({
  selector: 'td-player-screen',
  template: playerScreenTemplate,
  styles: playerScreenStyles,
})
export class PlayerScreenComponent {
  public elementRef!: HTMLElement

  public activePlaylist = activePlaylist
  public playingMixtapeId = playingMixtapeId
  public authStatus = authStatus
  public authAction = authAction
  public currentIndex = currentIndex
  public playing = playing
  public failedVideoIds = failedVideoIds
  public mode = mode
  public externalVideo = externalVideo
  public externalVideoLoading = externalVideoLoading
  public shortcutsOpen = shortcutsOpen
  public pickerTrack = pickerTrack
  public track = track
  public unavailable = unavailable
  public hiddenTracks = hiddenTracks

  /** Whether the "Hidden" section at the bottom of the queue is expanded. */
  public showHidden = false

  /** "Add a video" form state while a mixtape is playing. */
  public addUrl = ''
  public addError = ''
  public adding = false

  // CSS :hover never re-evaluates on scroll, only on actual pointer
  // movement — scrolling a row under a stationary cursor leaves it (or the
  // row you scrolled away from) stuck showing its hover-only action button.
  // Tracking hover in JS and clearing it explicitly on scroll fixes that.
  public hoveredIndex: number | null = null
  public dragIndex: number | null = null
  public dragOverIndex: number | null = null

  private _lastScrolledIndex = -1
  private _lastScrolledPlaylist: unknown = null

  /** Keep the queue following the active song automatically. */
  public onRender(): void {
    const index = this.currentIndex()
    const playlist = this.activePlaylist()
    if (index === this._lastScrolledIndex && playlist === this._lastScrolledPlaylist) return
    this._lastScrolledIndex = index
    this._lastScrolledPlaylist = playlist
    this.scrollToCurrent()
  }

  /** Centers the current track's row in the queue list. Scrolls only the
   *  list itself so the rest of the layout never jumps. */
  public scrollToCurrent(behavior: ScrollBehavior = 'smooth'): void {
    const list = this.elementRef.shadowRoot?.querySelector<HTMLOListElement>('.track-list')
    if (!list || typeof list.scrollTo !== 'function') return
    const row = list.querySelector('[aria-current="true"]')?.closest('li')
    if (!row) return
    const listRect = list.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const delta = rowRect.top - listRect.top - (list.clientHeight - rowRect.height) / 2
    list.scrollTo({ top: list.scrollTop + delta, behavior })
  }

  public selectTrack(index: number): void {
    selectTrack(index)
  }

  public next(): void {
    moveTrack(1)
  }

  public returnToQueue(): void {
    returnToQueue()
  }

  public setMode(value: 'video' | 'audio'): void {
    this.mode.set(value)
  }

  public backToLibrary(): void {
    changeSource()
  }

  public openShortcuts(): void {
    this.shortcutsOpen.set(true)
  }

  public pickTrack(track: Track): void {
    this.pickerTrack.set(track)
  }

  public removeFromMixtape(track: Track): void {
    const mixtapeId = this.playingMixtapeId()
    if (mixtapeId) toggleMixtapeTrack(mixtapeId, track)
  }

  public hideTrack(track: Track): void {
    hideSourceTrack(track.id)
  }

  public unhideTrack(track: Track): void {
    unhideSourceTrack(track.id)
  }

  public isSingleVideoSource(playlist: Playlist): boolean {
    return !this.playingMixtapeId() && /video/i.test(playlist.kind)
  }

  public convertToMixtape(): void {
    const sourceUrl = this.activePlaylist()?.sourceUrl
    if (!sourceUrl) return
    this.addUrl = ''
    this.addError = ''
    convertSourceToMixtape(sourceUrl)
  }

  public onAddUrlInput(event: Event): void {
    this.addUrl = (event.target as HTMLInputElement).value
    this.addError = ''
  }

  public submitAddVideo(event: Event): void {
    event.preventDefault()
    const mixtapeId = this.playingMixtapeId()
    const videoUrl = this.addUrl.trim()
    if (!mixtapeId || !videoUrl || this.adding) return
    this.adding = true
    this.addError = ''
    addVideoToMixtape(mixtapeId, videoUrl)
      .then(() => {
        this.addUrl = ''
      })
      .catch((caught: unknown) => {
        this.addError = caught instanceof Error ? caught.message : 'Tapedeck could not add that video.'
      })
      .finally(() => {
        this.adding = false
      })
  }

  public toggleHidden(): void {
    this.showHidden = !this.showHidden
  }

  public clearHover(): void {
    this.hoveredIndex = null
  }

  public handleDrop(index: number): void {
    const mixtapeId = this.playingMixtapeId()
    if (mixtapeId && this.dragIndex !== null && this.dragIndex !== index) {
      reorderMixtapeTrack(mixtapeId, this.dragIndex, index)
    }
    this.dragIndex = null
    this.dragOverIndex = null
  }
}
