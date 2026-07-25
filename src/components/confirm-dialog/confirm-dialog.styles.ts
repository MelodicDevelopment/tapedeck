import { css, type TemplateResult } from '@melodicdev/core'

export const confirmDialogStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .confirm-dialog {
    width: min(100%, 380px);
    align-items: center;
    text-align: center;
  }

  .confirm-dialog__icon {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border-radius: 50%;
    color: var(--td-warn);
    background: var(--td-warn-dim);
  }

  .confirm-dialog__icon svg {
    width: 21px;
    height: 21px;
  }

  .confirm-dialog__copy strong {
    display: block;
    margin-bottom: 6px;
    font-size: 16px;
    font-weight: 650;
  }

  .confirm-dialog__copy p {
    margin: 0;
    color: var(--td-muted);
    font-size: 13.5px;
    line-height: 1.5;
  }

  .confirm-dialog__actions {
    display: flex;
    width: 100%;
    gap: 10px;
  }

  .confirm-dialog__actions .button {
    flex: 1;
  }
`
