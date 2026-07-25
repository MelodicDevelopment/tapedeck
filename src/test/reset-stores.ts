import { resetActionState } from '../store/actions'
import * as player from '../store/player'
import * as state from '../store/state'
import { emptyLibrary } from '../lib/library'

/** Resets every module-level signal to its initial value between tests. */
export function resetStores(): void {
  state.view.set('welcome')
  state.url.set('')
  state.error.set('')
  state.playlist.set(null)
  state.library.set(emptyLibrary())
  state.libraryLoaded.set(false)
  state.playingMixtapeId.set(null)
  state.confirmDeleteMixtape.set(null)
  state.authStatus.set(state.desktop ? null : { configured: true, authenticated: true })
  state.authAction.set(null)
  state.syncStatus.set('idle')
  state.syncDevices.set([])
  state.syncError.set('')
  state.updateInfo.set(null)
  state.updateDismissed.set(false)

  player.currentIndex.set(0)
  player.playing.set(false)
  player.setElapsed(0)
  player.duration.set(0)
  player.volume.set(70)
  player.failedVideoIds.set(new Set())
  player.seekTo.set(null)
  player.pickerTrack.set(null)
  player.shuffle.set(false)
  player.repeatMode.set('off')
  player.shortcutsOpen.set(false)
  player.mode.set('video')
  player.externalVideo.set(null)
  player.externalVideoLoading.set(false)

  resetActionState()
}
