import { css, type TemplateResult } from '@melodicdev/core'

export const libraryCardStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .library-grid__card {
    position: relative;
    border: 1px solid var(--td-border);
    border-radius: 13px;
    background: var(--td-panel);
    transition: border-color 150ms ease, transform 150ms ease;
    list-style: none;
  }

  .library-grid__card:hover {
    border-color: var(--td-border-strong);
    transform: translateY(-2px);
  }

  .library-grid__art {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 0;
    border-radius: 13px 13px 0 0;
    cursor: pointer;
    background: transparent;
    padding: 0;
  }

  .library-grid__art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .library-grid__art:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .library-grid__placeholder {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--td-faint);
    background: var(--td-raised);
  }

  .library-grid__pill {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 3px 8px;
    border-radius: 6px;
    color: var(--td-accent);
    background: rgb(20 18 15 / 78%);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .library-grid__remove {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border: 0;
    border-radius: 7px;
    color: var(--td-text);
    background: rgb(20 18 15 / 65%);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .library-grid__card:hover .library-grid__remove,
  .library-grid__remove:focus-visible {
    opacity: 1;
  }

  .library-grid__remove:hover {
    color: #e8998c;
  }

  .library-grid__remove svg {
    width: 13px;
    height: 13px;
  }

  .library-grid__body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px 14px 14px;
  }

  .library-grid__body strong {
    overflow: hidden;
    color: var(--td-text);
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-grid__body span {
    overflow: hidden;
    color: var(--td-faint);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`
