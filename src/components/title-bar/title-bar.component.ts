import { MelodicComponent } from '@melodicdev/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { titleBarTemplate } from './title-bar.template'
import { titleBarStyles } from './title-bar.styles'

/**
 * td-title-bar — custom title bar for the frameless Windows build (see the
 * `decorations(false)` branch in src-tauri/src/lib.rs) so Tapedeck gets a
 * clean, app-themed window frame instead of the default Windows chrome.
 * macOS keeps its native title bar and never renders this.
 */
@MelodicComponent({
  selector: 'td-title-bar',
  template: titleBarTemplate,
  styles: titleBarStyles,
})
export class TitleBarComponent {
  public maximized = false

  private _disposed = false
  private _unlisten: (() => void) | undefined

  public onCreate(): void {
    document.body.classList.add('frameless-titlebar')
    const win = getCurrentWindow()
    win.isMaximized().then((value) => {
      if (!this._disposed) this.maximized = value
    })
    win
      .onResized(() => {
        win.isMaximized().then((value) => {
          if (!this._disposed) this.maximized = value
        })
      })
      .then((dispose) => {
        if (this._disposed) {
          dispose()
          return
        }
        this._unlisten = dispose
      })
  }

  public onDestroy(): void {
    this._disposed = true
    this._unlisten?.()
    document.body.classList.remove('frameless-titlebar')
  }

  public minimize(): void {
    void getCurrentWindow().minimize()
  }

  public toggleMaximize(): void {
    void getCurrentWindow().toggleMaximize()
  }

  public close(): void {
    void getCurrentWindow().close()
  }
}
