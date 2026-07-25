import { css, type TemplateResult } from '@melodicdev/core'

export const sourceSwitcherStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .source-card {
    position: relative;
    border-bottom: 1px solid #292621;
  }

  .source-card__trigger {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background-color 150ms ease;
  }

  .source-card__trigger:hover {
    background: var(--td-well);
  }

  .source-card__chevron {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    color: var(--td-faint);
  }

  .source-card__art {
    width: 46px;
    height: 46px;
    flex: 0 0 auto;
    border: 1px solid var(--td-hairline);
    border-radius: 10px;
    object-fit: cover;
  }

  .source-card__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 3px;
  }

  .source-card__copy strong,
  .source-card__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-card__copy strong {
    font-size: 14px;
    font-weight: 650;
  }

  .source-card__copy span {
    color: var(--td-muted);
    font-size: 11.5px;
  }

  .source-switcher {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    left: 12px;
    right: 12px;
    max-height: 360px;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid var(--td-border-strong);
    border-radius: 13px;
    background: var(--td-overlay);
    box-shadow: 0 16px 44px rgb(0 0 0 / 55%);
  }

  .source-switcher__label {
    margin: 6px 8px 4px;
    color: var(--td-faint);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .source-switcher__row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    cursor: pointer;
    text-align: left;
  }

  .source-switcher__row:hover {
    background: var(--td-raised);
  }

  .source-switcher__thumb {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    overflow: hidden;
    border-radius: 8px;
    color: var(--td-faint);
    background: var(--td-raised);
  }

  .source-switcher__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .source-switcher__thumb svg {
    width: 15px;
    height: 15px;
  }

  .source-switcher__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  .source-switcher__copy strong,
  .source-switcher__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-switcher__copy strong {
    font-size: 13px;
    font-weight: 600;
  }

  .source-switcher__copy span {
    color: var(--td-muted);
    font-size: 11px;
  }

  .source-switcher__check {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    color: var(--td-accent);
  }

  .source-switcher__divider {
    margin: 6px 4px;
    border-top: 1px solid var(--td-border);
  }

  .source-switcher__row--new {
    color: var(--td-accent);
  }

  .source-switcher__row--new svg {
    width: 15px;
    height: 15px;
  }

  @media (max-width: 900px) {
    .source-card {
      padding-block: 14px;
    }
  }
`
