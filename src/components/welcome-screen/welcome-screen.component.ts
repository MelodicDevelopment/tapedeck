import { MelodicComponent } from '@melodicdev/core'
import {
  closeOverlay,
  exportCurrentLibrary,
  handleLoad,
  importLibrary,
  openSavedSource,
  playMixtape,
  removeSavedSource,
  requestDeleteMixtape,
  setUrl,
  signIn,
} from '../../store/actions'
import {
  authAction,
  authStatus,
  desktop,
  error,
  hasPlayer,
  library,
  syncDevices,
  syncError,
  syncStatus,
  url,
  view,
} from '../../store/state'
import type { LibraryEntry } from './welcome-screen.types'
import { welcomeScreenTemplate } from './welcome-screen.template'
import { welcomeScreenStyles } from './welcome-screen.styles'

/**
 * td-welcome-screen — the landing view: paste form, Google auth gate, saved
 * library grid, continue-listening card, and sync/import/export affordances.
 * Rendered as an overlay when a player is active behind it.
 */
@MelodicComponent({
  selector: 'td-welcome-screen',
  template: welcomeScreenTemplate,
  styles: welcomeScreenStyles,
})
export class WelcomeScreenComponent {
  public elementRef!: HTMLElement

  public url = url
  public error = error
  public view = view
  public desktop = desktop
  public authStatus = authStatus
  public authAction = authAction
  public library = library
  public hasPlayer = hasPlayer
  public syncStatus = syncStatus
  public syncDevices = syncDevices
  public syncError = syncError

  public libraryQuery = ''
  public importError = ''
  public exportError = ''

  public submit(event: Event): void {
    event.preventDefault()
    void handleLoad()
  }

  public onUrlInput(event: Event): void {
    setUrl((event.target as HTMLInputElement).value)
  }

  public onQueryInput(event: Event): void {
    this.libraryQuery = (event.target as HTMLInputElement).value
  }

  public useExampleUrl(example: string): void {
    setUrl(example)
  }

  public close(): void {
    closeOverlay()
  }

  public signIn(): void {
    void signIn()
  }

  public openEntry(entry: LibraryEntry): void {
    if (entry.type === 'source') {
      openSavedSource(entry.data.url)
      return
    }
    playMixtape(entry.data.id)
  }

  public removeEntry(entry: LibraryEntry): void {
    if (entry.type === 'source') {
      removeSavedSource(entry.data.url)
      return
    }
    requestDeleteMixtape(entry.data.id)
  }

  public handleExport(): void {
    this.importError = ''
    this.exportError = ''
    exportCurrentLibrary().catch(() => {
      this.exportError = 'Tapedeck could not export your library.'
    })
  }

  public openImportPicker(): void {
    this.elementRef.shadowRoot
      ?.querySelector<HTMLInputElement>('input[type="file"]')
      ?.click()
  }

  public handleImportFile(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    this.exportError = ''
    this.importError = ''
    file
      .text()
      .then((text) => importLibrary(JSON.parse(text)))
      .catch(() => {
        this.importError = 'That file isn’t a valid Tapedeck library export.'
      })
  }
}
