import { css, type TemplateResult } from '@melodicdev/core'

export const shortcutsModalStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .shortcuts-modal {
    width: min(100%, 340px);
  }

  .shortcuts-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .shortcuts-modal__header strong {
    font-size: 15px;
    font-weight: 650;
  }

  .shortcuts-modal__list {
    display: flex;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: 12px;
    list-style: none;
  }

  .shortcuts-modal__list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--td-muted);
    font-size: 13px;
  }

  .shortcuts-modal__keys {
    display: flex;
    gap: 4px;
  }

  .shortcuts-modal__keys kbd {
    min-width: 20px;
    padding: 3px 7px;
    border: 1px solid var(--td-border-strong);
    border-radius: 6px;
    color: var(--td-text);
    background: #2c2822;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    text-align: center;
  }
`
