import { css, type TemplateResult } from '@melodicdev/core'

export const searchResultsStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .results {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 16px;
  }

  .results__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .results__title {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .results__heading {
    margin: 0;
    color: var(--td-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .results__title h2 {
    margin: 0;
    overflow: hidden;
    color: var(--td-text);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results__close {
    display: inline-flex;
    height: 32px;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: 1px solid var(--td-border);
    border-radius: 999px;
    background: transparent;
    color: var(--td-muted);
    cursor: pointer;
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .results__close:hover {
    color: var(--td-text);
    border-color: var(--td-border-strong);
  }

  .results__close svg {
    width: 14px;
    height: 14px;
  }

  .results__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 56px 20px;
    border: 1px dashed var(--td-border);
    border-radius: 13px;
    color: var(--td-muted);
    text-align: center;
  }

  .results__state svg {
    width: 22px;
    height: 22px;
    color: var(--td-faint);
  }

  .results__state p {
    max-width: 420px;
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
  }

  .results__state--error svg {
    color: var(--td-error);
  }

  .results__grid {
    display: grid;
    margin: 0;
    padding: 0;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 14px;
    list-style: none;
  }

  .result-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--td-border);
    border-radius: 13px;
    background: var(--td-panel);
    transition: border-color 150ms ease, transform 150ms ease;
  }

  .result-card:hover,
  .result-card:focus-within {
    border-color: var(--td-border-strong);
    transform: translateY(-2px);
  }

  .result-card__art {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: var(--td-raised);
    cursor: pointer;
  }

  .result-card__art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 200ms ease;
  }

  .result-card__art:hover img {
    transform: scale(1.03);
  }

  .result-card__duration {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 2px 6px;
    border-radius: 5px;
    color: #fff;
    background: rgb(0 0 0 / 75%);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .result-card__play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #fff;
    background: rgb(0 0 0 / 35%);
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .result-card__play svg {
    width: 38px;
    height: 38px;
    filter: drop-shadow(0 2px 8px rgb(0 0 0 / 50%));
  }

  .result-card__art:hover .result-card__play,
  .result-card__art:focus-visible .result-card__play {
    opacity: 1;
  }

  .result-card__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px 14px;
  }

  .result-card__title {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--td-text);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    text-align: left;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .result-card__title:hover {
    color: var(--td-accent-soft);
  }

  .result-card__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin: 0;
    color: var(--td-muted);
    font-size: 12px;
  }

  .result-card__saved {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--td-accent-soft);
    font-weight: 600;
  }

  .result-card__saved svg {
    width: 12px;
    height: 12px;
  }

  .result-card__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 8px;
  }

  .result-card__actions .button--small {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .result-card__actions .button--small svg {
    width: 12px;
    height: 12px;
  }

  .result-card__add {
    display: inline-flex;
    height: 30px;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border: 1px solid var(--td-border);
    border-radius: 8px;
    background: transparent;
    color: var(--td-muted);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  .result-card__add:hover {
    color: var(--td-text);
    border-color: var(--td-border-strong);
    background: var(--td-raised);
  }

  .result-card__add svg {
    width: 14px;
    height: 14px;
  }
`
