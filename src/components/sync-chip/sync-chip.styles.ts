import { css, type TemplateResult } from '@melodicdev/core'

export const syncChipStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .sync-chip {
    position: relative;
  }

  .sync-chip__trigger {
    display: inline-flex;
    height: 34px;
    align-items: center;
    gap: 7px;
    padding: 0 14px;
    border: 1px solid var(--td-border);
    border-radius: 10px;
    color: var(--td-muted);
    background: transparent;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
  }

  .sync-chip__trigger:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .sync-chip__trigger svg {
    width: 14px;
    height: 14px;
  }

  .sync-chip__trigger--warn {
    border-color: rgb(224 169 115 / 30%);
    color: var(--td-warn);
  }

  .sync-popover {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    right: 0;
    width: 320px;
    padding: 16px;
    border: 1px solid var(--td-border-strong);
    border-radius: 13px;
    background: var(--td-overlay);
    box-shadow: 0 16px 44px rgb(0 0 0 / 55%);
  }

  .sync-popover__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .sync-popover__header strong {
    font-size: 14px;
    font-weight: 650;
  }

  .sync-popover__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--td-faint);
    font-size: 11.5px;
    font-weight: 600;
  }

  .sync-popover__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--td-faint);
  }

  .sync-popover__status--synced {
    color: var(--td-success);
  }

  .sync-popover__status--synced .sync-popover__dot {
    background: var(--td-success);
  }

  .sync-popover__status--syncing {
    color: var(--td-accent);
  }

  .sync-popover__status--syncing .sync-popover__dot {
    background: var(--td-accent);
  }

  .sync-popover__status--offline .sync-popover__dot,
  .sync-popover__status--error .sync-popover__dot {
    background: var(--td-error);
  }

  .sync-popover__status--offline,
  .sync-popover__status--error {
    color: var(--td-error);
  }

  .sync-popover__copy {
    margin: 0 0 12px;
    color: var(--td-muted);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .sync-popover__error {
    margin: 0 0 12px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--td-error-dim);
    color: var(--td-error);
    font-size: 12px;
  }

  .sync-popover__devices {
    margin-bottom: 14px;
    padding: 4px 10px;
    border-radius: 10px;
    background: var(--td-well);
  }

  .sync-popover__device {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 0;
    font-size: 12px;
  }

  .sync-popover__device:not(:last-of-type) {
    border-bottom: 1px solid var(--td-border);
  }

  .sync-popover__device svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    color: var(--td-faint);
  }

  .sync-popover__device-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--td-text-soft);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sync-popover__device-active {
    color: var(--td-success);
    font-weight: 600;
  }

  .sync-popover__signed-in {
    margin: 0;
    padding-top: 8px;
    border-top: 1px solid var(--td-border);
    color: var(--td-faint);
    font-size: 11px;
  }

  .sync-popover__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sync-popover__actions .button--primary {
    flex: 1 0 100%;
  }

  .sync-popover__actions .button--ghost {
    flex: 1;
    gap: 6px;
  }

  .sync-popover__actions .button--ghost svg {
    width: 13px;
    height: 13px;
  }
`
