import { Cloud, CloudOff, Download, Laptop, RefreshCw, Upload } from 'lucide-react'
import { useState } from 'react'
import type { SyncedDevice } from '../api/sync'
import { useDismiss } from '../hooks/useDismiss'
import { formatRelativeTime } from '../lib/time'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

type SyncChipProps = {
  status: SyncStatus
  devices: SyncedDevice[]
  errorMessage: string
  userEmail?: string
  onSyncNow: () => void
  onExport: () => void
  onImportClick: () => void
}

const CHIP_LABEL: Record<SyncStatus, string> = {
  idle: 'Sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync error',
}

const STATUS_LINE: Record<SyncStatus, string> = {
  idle: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced just now',
  offline: 'Offline',
  error: 'Sync failed',
}

export function SyncChip({ status, devices, errorMessage, userEmail, onSyncNow, onExport, onImportClick }: SyncChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false), open)
  const warn = status === 'error' || status === 'offline'

  return (
    <div className="sync-chip" ref={ref}>
      <button
        type="button"
        className={`sync-chip__trigger${warn ? ' sync-chip__trigger--warn' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {status === 'syncing' ? (
          <RefreshCw className="spin" aria-hidden="true" />
        ) : warn ? (
          <CloudOff aria-hidden="true" />
        ) : (
          <Cloud aria-hidden="true" />
        )}
        {CHIP_LABEL[status]}
      </button>

      {open && (
        <div className="sync-popover" role="dialog" aria-label="Library sync">
          <div className="sync-popover__header">
            <strong>Library sync</strong>
            <span className={`sync-popover__status sync-popover__status--${status}`}>
              <span className="sync-popover__dot" aria-hidden="true" />
              {STATUS_LINE[status]}
            </span>
          </div>
          <p className="sync-popover__copy">
            Saved channels, playlists and playback positions sync to your account — sign in anywhere to pick up where you left off.
          </p>
          {errorMessage && <p className="sync-popover__error">{errorMessage}</p>}

          {devices.length > 0 && (
            <div className="sync-popover__devices">
              {devices.map((device) => (
                <div key={device.id} className="sync-popover__device">
                  <Laptop aria-hidden="true" />
                  <span className="sync-popover__device-name">
                    {device.name}
                    {device.isThisDevice && ' — this device'}
                  </span>
                  <span className={device.isThisDevice ? 'sync-popover__device-active' : undefined}>
                    {device.isThisDevice ? 'Active now' : formatRelativeTime(device.lastActiveAt)}
                  </span>
                </div>
              ))}
              {userEmail && <p className="sync-popover__signed-in">Signed in as {userEmail}</p>}
            </div>
          )}

          <div className="sync-popover__actions">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={onSyncNow}
              disabled={status === 'syncing'}
            >
              {status === 'syncing' ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" className="button button--ghost button--small" onClick={onExport}>
              <Download aria-hidden="true" /> Export file…
            </button>
            <button type="button" className="button button--ghost button--small" onClick={onImportClick}>
              <Upload aria-hidden="true" /> Import file…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
