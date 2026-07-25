import { css, type TemplateResult } from '@melodicdev/core'

export const accountSummaryStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .account-summary {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
    padding: 5px 6px 5px 7px;
    border: 1px solid var(--td-border);
    border-radius: 12px;
    background: rgb(33 30 26 / 72%);
  }

  .account-summary > img,
  .account-summary__avatar {
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    border-radius: 8px;
  }

  .account-summary > img {
    object-fit: cover;
  }

  .account-summary__avatar {
    display: grid;
    place-items: center;
    color: var(--td-bg);
    background: var(--td-accent);
    font-size: 12px;
    font-weight: 700;
  }

  .account-summary__copy {
    display: flex;
    min-width: 0;
    max-width: 180px;
    flex-direction: column;
    gap: 1px;
    text-align: left;
  }

  .account-summary__copy strong,
  .account-summary__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-summary__copy strong {
    color: var(--td-text-soft);
    font-size: 12px;
    font-weight: 650;
  }

  .account-summary__copy span {
    color: var(--td-faint);
    font-size: 10px;
  }

  .account-summary__sign-out {
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 8px;
    color: var(--td-muted);
    background: transparent;
    cursor: pointer;
  }

  .account-summary__sign-out:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .account-summary__sign-out svg {
    width: 14px;
    height: 14px;
  }

  @media (max-width: 620px) {
    .account-summary__copy {
      display: none;
    }
  }
`
