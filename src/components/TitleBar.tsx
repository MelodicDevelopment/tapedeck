import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Custom title bar for the frameless Windows build (see the
 * `decorations(false)` branch in src-tauri/src/lib.rs) so Tapedeck gets a
 * clean, app-themed window frame instead of the default Windows chrome.
 * macOS keeps its native title bar and never renders this.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    document.body.classList.add('frameless-titlebar')
    const win = getCurrentWindow()
    let disposed = false
    let unlisten: (() => void) | undefined

    win.isMaximized().then((value) => {
      if (!disposed) setMaximized(value)
    })
    win.onResized(() => {
      win.isMaximized().then((value) => {
        if (!disposed) setMaximized(value)
      })
    }).then((dispose) => {
      if (disposed) {
        dispose()
      } else {
        unlisten = dispose
      }
    })

    return () => {
      disposed = true
      unlisten?.()
      document.body.classList.remove('frameless-titlebar')
    }
  }, [])

  const win = getCurrentWindow()

  return (
    <div className="app-titlebar" data-tauri-drag-region>
      <span className="app-titlebar__title" data-tauri-drag-region>
        Tapedeck
      </span>
      <div className="app-titlebar__controls">
        <button
          type="button"
          className="app-titlebar__button"
          aria-label="Minimize"
          onClick={() => win.minimize()}
        >
          <Minus aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className="app-titlebar__button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => win.toggleMaximize()}
        >
          {maximized ? <Copy aria-hidden="true" size={14} /> : <Square aria-hidden="true" size={13} />}
        </button>
        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--close"
          aria-label="Close"
          onClick={() => win.close()}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  )
}
