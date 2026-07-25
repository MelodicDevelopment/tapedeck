import { css, type TemplateResult } from '@melodicdev/core'

export const titleBarStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .app-titlebar {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--td-titlebar-h);
    padding-left: 12px;
    background: var(--td-panel);
    border-bottom: 1px solid var(--td-border);
    user-select: none;
  }

  .app-titlebar__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--td-muted);
    letter-spacing: 0.02em;
  }

  .app-titlebar__controls {
    display: flex;
    align-items: stretch;
    height: 100%;
  }

  .app-titlebar__button {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--td-text-soft);
  }

  .app-titlebar__button:hover {
    background: var(--td-raised);
    color: var(--td-text);
  }

  .app-titlebar__button--close:hover {
    background: #e81123;
    color: #fff;
  }
`
