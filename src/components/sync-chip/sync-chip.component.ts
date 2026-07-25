import { MelodicComponent } from '@melodicdev/core'
import { authStatus, syncDevices, syncError, syncStatus } from '../../store/state'
import { createDismiss } from '../../ui/dismiss'
import { syncChipTemplate } from './sync-chip.template'
import { syncChipStyles } from './sync-chip.styles'

/**
 * td-sync-chip — the cloud-sync status chip with its popover (device list,
 * sync-now, export/import).
 *
 * @fires td:export - The user chose "Export file…" (the welcome screen owns
 *   the export flow and its error state).
 * @fires td:import - The user chose "Import file…" (the welcome screen owns
 *   the hidden file input).
 */
@MelodicComponent({
  selector: 'td-sync-chip',
  template: syncChipTemplate,
  styles: syncChipStyles,
})
export class SyncChipComponent {
  public elementRef!: HTMLElement

  public syncStatus = syncStatus
  public syncDevices = syncDevices
  public syncError = syncError
  public authStatus = authStatus
  public open = false

  private _disposeDismiss: (() => void) | undefined

  public onCreate(): void {
    this._disposeDismiss = createDismiss(
      this.elementRef,
      () => this.open,
      () => (this.open = false),
    )
  }

  public onDestroy(): void {
    this._disposeDismiss?.()
  }

  public emit(name: 'td:export' | 'td:import'): void {
    this.open = false
    this.elementRef.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }
}
