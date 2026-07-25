// NOTE: plain .map() instead of repeat() — repeat() crashes when nested
// inside conditionally-rendered sub-templates (candidate fix for the melodic
// repo); Envy's components use .map() the same way.
import { html, unsafeHTML, type TemplateResult } from '@melodicdev/core'
import { formatRelativeTime } from '../../lib/time'
import { syncNow } from '../../store/actions'
import type { SyncStatus } from '../../store/state'
import { icon } from '../../ui/icons'
import type { SyncChipComponent } from './sync-chip.component'

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

export function syncChipTemplate(c: SyncChipComponent): TemplateResult {
  const status = c.syncStatus()
  const warn = status === 'error' || status === 'offline'
  return html`
    <div class="sync-chip">
      <button
        type="button"
        class=${warn ? 'sync-chip__trigger sync-chip__trigger--warn' : 'sync-chip__trigger'}
        @click=${() => (c.open = !c.open)}
        aria-expanded=${c.open ? 'true' : 'false'}
        aria-haspopup="dialog"
      >
        ${status === 'syncing'
          ? unsafeHTML(icon('refreshCw', { class: 'spin' }))
          : warn
            ? unsafeHTML(icon('cloudOff'))
            : unsafeHTML(icon('cloud'))}
        ${CHIP_LABEL[status]}
      </button>

      ${c.open ? syncPopover(c, status) : html``}
    </div>
  `
}

function syncPopover(c: SyncChipComponent, status: SyncStatus): TemplateResult {
  return html`
    <div class="sync-popover" role="dialog" aria-label="Library sync">
      <div class="sync-popover__header">
        <strong>Library sync</strong>
        <span class=${`sync-popover__status sync-popover__status--${status}`}>
          <span class="sync-popover__dot" aria-hidden="true"></span>
          ${STATUS_LINE[status]}
        </span>
      </div>
      <p class="sync-popover__copy">
        Saved channels, playlists and playback positions sync to your account — sign in anywhere to
        pick up where you left off.
      </p>
      ${c.syncError() ? html`<p class="sync-popover__error">${c.syncError()}</p>` : html``}
      ${c.syncDevices().length > 0 ? deviceList(c) : html``}

      <div class="sync-popover__actions">
        <button
          type="button"
          class="button button--primary button--small"
          @click=${() => syncNow()}
          ?disabled=${status === 'syncing'}
        >
          ${status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
        <button type="button" class="button button--ghost button--small" @click=${() => c.emit('td:export')}>
          ${unsafeHTML(icon('download'))} Export file…
        </button>
        <button type="button" class="button button--ghost button--small" @click=${() => c.emit('td:import')}>
          ${unsafeHTML(icon('upload'))} Import file…
        </button>
      </div>
    </div>
  `
}

function deviceList(c: SyncChipComponent): TemplateResult {
  const email = c.authStatus()?.user?.email
  return html`
    <div class="sync-popover__devices">
      ${c.syncDevices().map(
        (device) => html`
          <div class="sync-popover__device">
            ${unsafeHTML(icon('laptop'))}
            <span class="sync-popover__device-name">
              ${device.name}${device.isThisDevice ? ' — this device' : ''}
            </span>
            <span class=${device.isThisDevice ? 'sync-popover__device-active' : ''}>
              ${device.isThisDevice ? 'Active now' : formatRelativeTime(device.lastActiveAt)}
            </span>
          </div>
        `,
      )}
      ${email ? html`<p class="sync-popover__signed-in">Signed in as ${email}</p>` : html``}
    </div>
  `
}
