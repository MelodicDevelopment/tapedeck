import { css, type TemplateResult } from '@melodicdev/core'

export const appStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .update-banner {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 8px 16px;
    background: var(--td-accent);
    color: var(--td-bg);
    font-size: 13px;
    font-weight: 550;
  }

  .update-banner__restart {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--td-bg);
    font: inherit;
    font-weight: 650;
    text-decoration: underline;
    white-space: nowrap;
    cursor: pointer;
  }

  .update-banner__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 0;
    background: transparent;
    color: var(--td-bg);
    cursor: pointer;
    opacity: 0.7;
  }

  .update-banner__dismiss:hover {
    opacity: 1;
  }

  .update-banner__dismiss svg {
    width: 14px;
    height: 14px;
  }
`
