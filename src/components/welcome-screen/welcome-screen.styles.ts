import { css, type TemplateResult } from '@melodicdev/core'

export const welcomeScreenStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .welcome-shell {
    display: grid;
    min-height: calc(100vh - var(--td-titlebar-h));
    min-height: calc(100dvh - var(--td-titlebar-h));
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 43%, rgb(139 127 240 / 5%), transparent 31rem),
      var(--td-bg);
  }

  .welcome-shell--overlay {
    position: fixed;
    z-index: 20;
    inset: 0;
    top: var(--td-titlebar-h);
  }

  .welcome-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 22px 28px;
  }

  .welcome-header__left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .welcome-header__back {
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

  .welcome-header__back:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .welcome-header__back svg {
    width: 14px;
    height: 14px;
  }

  .welcome-header__right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .welcome-header__actions {
    display: flex;
    gap: 4px;
  }

  .welcome-header__icon-button {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--td-border);
    border-radius: 10px;
    color: var(--td-muted);
    background: transparent;
    cursor: pointer;
  }

  .welcome-header__icon-button:hover:not(:disabled) {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .welcome-header__icon-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .welcome-header__icon-button svg {
    width: 15px;
    height: 15px;
  }

  .import-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 0 0 12px;
    padding: 0 28px;
    color: var(--td-error);
    font-size: 13px;
    text-align: center;
  }

  .import-error svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
  }

  .welcome-content {
    display: flex;
    min-height: 0;
    padding: 28px 24px;
    overflow-y: auto;
  }

  /* Centers like the old grid when content is short, scrolls when the
     library below the card makes it tall. */
  .welcome-stack {
    display: flex;
    width: min(100%, 540px);
    align-items: center;
    flex-direction: column;
    gap: 34px;
    margin: auto;
  }

  .welcome-stack--wide {
    width: min(100%, 1040px);
    align-items: stretch;
  }

  .welcome-card,
  .loading-state {
    width: min(100%, 540px);
    text-align: center;
  }

  /* Always centers itself, even when the wide library layout (which
     stretches its children full-width for the grid) is what's active — the
     loading/checking-auth states can render before the library view does. */
  .loading-state {
    align-self: center;
  }

  .welcome-card h1 {
    margin: 12px 0 10px;
    font-size: clamp(2rem, 4vw, 2.55rem);
    line-height: 1.1;
    letter-spacing: -0.035em;
  }

  .welcome-card__copy {
    max-width: 430px;
    margin: 0 auto 34px;
    color: var(--td-muted);
    font-size: 15px;
    line-height: 1.6;
    text-wrap: balance;
  }

  .auth-gate {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 16px;
    margin: -8px 0 24px;
    padding: 17px;
    border: 1px solid var(--td-border-strong);
    border-radius: 13px;
    background: var(--td-well);
    box-shadow: 0 10px 28px rgb(0 0 0 / 10%);
  }

  .auth-gate__copy {
    display: flex;
    width: 100%;
    align-items: flex-start;
    gap: 11px;
    text-align: left;
  }

  .auth-gate__copy > svg {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--td-accent-soft);
    stroke-width: 1.7;
  }

  .auth-gate__copy div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .auth-gate__copy strong {
    color: var(--td-text-soft);
    font-size: 13px;
    font-weight: 650;
  }

  .auth-gate__copy span {
    color: var(--td-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .google-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 17px;
    border: 1px solid #49443d;
    border-radius: 10px;
    color: #eae7e0;
    background: #2a2722;
    cursor: pointer;
    font-size: 13px;
    font-weight: 650;
    transition: border-color 150ms ease, background-color 150ms ease;
  }

  .google-button:hover:not(:disabled) {
    border-color: #625b52;
    background: #312d27;
  }

  .google-button__mark {
    display: grid;
    width: 20px;
    height: 20px;
    place-items: center;
    border-radius: 5px;
    color: #282520;
    background: #f3f0e9;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: 700;
  }

  .google-button > svg {
    width: 16px;
    height: 16px;
  }

  .source-form {
    width: 100%;
  }

  .source-form__row {
    display: flex;
    gap: 10px;
  }

  .source-form__helper,
  .source-form__error {
    display: flex;
    min-height: 20px;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 12px 0 0;
    color: var(--td-faint);
    font-size: 13px;
  }

  .source-form__helpers {
    display: flex;
    min-height: 20px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    margin-top: 12px;
    color: var(--td-faint);
    font-size: 13px;
  }

  .source-form__helpers .source-form__helper {
    min-height: 0;
    margin: 0;
  }

  .source-form__helper button {
    padding: 0;
    border: 0;
    color: #9b95a4;
    background: transparent;
    cursor: pointer;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    text-decoration: underline;
    text-decoration-color: #5e5964;
    text-underline-offset: 3px;
  }

  .source-form__helper button:hover {
    color: #c3bcf6;
  }

  .source-form__error {
    color: var(--td-error);
  }

  .source-form__error svg {
    width: 15px;
    height: 15px;
  }

  .welcome-footer {
    padding: 18px 28px;
    color: var(--td-faint);
    font-size: 12px;
    text-align: center;
  }

  .welcome-footer strong {
    color: var(--td-muted);
    font-weight: 600;
  }

  .loading-state__spinner {
    width: 44px;
    height: 44px;
    margin-bottom: 22px;
    color: var(--td-accent);
    animation: spin 800ms linear infinite;
  }

  .loading-state h1 {
    margin: 0 0 8px;
    font-size: 21px;
    letter-spacing: -0.02em;
  }

  .loading-state p {
    margin: 0;
    color: var(--td-muted);
    font-size: 14px;
  }

  .welcome-library-view {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 28px;
  }

  .compact-paste-bar {
    width: 100%;
  }

  .compact-paste-bar .source-form__row {
    max-width: 560px;
    margin: 0 auto;
  }

  .compact-paste-bar .input {
    height: 40px;
  }

  .compact-paste-bar .button--primary {
    height: 40px;
  }

  .compact-paste-bar .source-form__error {
    max-width: 560px;
    margin: 10px auto 0;
  }

  .library {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 14px;
  }

  .library__group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .library__group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .library__heading {
    margin: 0;
    color: var(--td-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
  }

  .library__search {
    display: flex;
    width: 240px;
    flex: 0 0 auto;
    align-items: center;
    gap: 9px;
    padding: 0 14px;
    border: 1px solid var(--td-border-strong);
    border-radius: 9px;
    color: var(--td-faint);
    background: var(--td-well);
  }

  .library__search svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }

  .library__search input {
    width: 100%;
    height: 34px;
    border: 0;
    outline: none;
    color: var(--td-text);
    background: transparent;
    font-size: 13px;
  }

  .library__search input::placeholder {
    color: #777167;
  }

  .library__empty {
    margin: 0;
    color: var(--td-faint);
    font-size: 13px;
    text-align: center;
  }

  .continue-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--td-border);
    border-radius: 14px;
    background: linear-gradient(100deg, #1f1c18, #1b1916 60%);
  }

  .continue-card__art {
    position: relative;
    width: 150px;
    height: 92px;
    flex: 0 0 auto;
    overflow: hidden;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    padding: 0;
    background: transparent;
  }

  .continue-card__art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .continue-card__placeholder {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--td-faint);
    background: var(--td-raised);
  }

  .continue-card__play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--td-text);
    background: rgb(15 14 12 / 28%);
  }

  .continue-card__play svg {
    width: 30px;
    height: 30px;
  }

  .continue-card__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 5px;
  }

  .continue-card__copy strong,
  .continue-card__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .continue-card__copy strong {
    font-size: 15.5px;
    font-weight: 650;
  }

  .continue-card__copy span {
    color: var(--td-muted);
    font-size: 12.5px;
  }

  .continue-card__progress {
    height: 4px;
    margin-top: 4px;
    border-radius: 2px;
    background: #33302b;
    overflow: hidden;
  }

  .continue-card__progress div {
    height: 100%;
    background: var(--td-accent);
  }

  .library-grid {
    display: grid;
    margin: 0;
    padding: 0;
    grid-template-columns: repeat(auto-fill, minmax(215px, 1fr));
    gap: 14px;
    list-style: none;
  }

  @media (max-width: 620px) {
    .welcome-header {
      padding: 18px 20px;
    }

    .welcome-content {
      padding: 24px 18px;
    }

    .welcome-card h1 {
      font-size: 32px;
    }

    .source-form__row {
      flex-direction: column;
    }

    .source-form__helpers {
      flex-wrap: wrap;
    }

    .button--primary {
      width: 100%;
    }

    .welcome-footer {
      padding: 16px 20px;
    }
  }
`
