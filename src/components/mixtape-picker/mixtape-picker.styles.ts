import { css, type TemplateResult } from '@melodicdev/core'

export const mixtapePickerStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .mixtape-options {
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .mixtape-option {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 11px;
    margin: 1px 0;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    text-align: left;
  }

  .mixtape-option:hover {
    background: #242119;
  }

  .mixtape-option--added {
    border-color: rgb(139 127 240 / 14%);
    background: var(--td-raised);
  }

  .mixtape-option > svg {
    width: 17px;
    height: 17px;
    flex: 0 0 auto;
    color: var(--td-muted);
  }

  .mixtape-option__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  .mixtape-option__copy strong,
  .mixtape-option__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mixtape-option__copy strong {
    font-size: 13px;
    font-weight: 600;
  }

  .mixtape-option__copy span {
    color: var(--td-muted);
    font-size: 11px;
  }

  .mixtape-option__check {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    color: var(--td-accent-soft);
  }

  .mixtape-options__empty {
    margin: 0;
    padding: 4px 2px;
    color: var(--td-muted);
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
  }

  .mixtape-create {
    display: flex;
    gap: 8px;
  }

  .mixtape-create .input {
    height: 42px;
  }

  .mixtape-create .button--primary {
    height: 42px;
    min-height: 42px;
    padding: 0 15px;
    font-size: 13px;
  }

  .mixtape-create .button--primary svg {
    width: 14px;
    height: 14px;
    margin-right: 5px;
  }
`
