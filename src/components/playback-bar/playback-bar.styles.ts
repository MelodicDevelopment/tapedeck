import { css, type TemplateResult } from '@melodicdev/core'

export const playbackBarStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .playback-bar {
    position: relative;
    z-index: 5;
    display: grid;
    grid-template-columns: 260px minmax(280px, 1fr) 180px;
    align-items: center;
    gap: 24px;
    padding: 0 20px;
    border-top: 1px solid #292621;
    background: var(--td-panel);
    box-shadow: 0 -8px 24px rgb(0 0 0 / 8%);
    height: 100%;
  }

  .now-playing {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
  }

  .now-playing img,
  .now-playing__thumb {
    width: 54px;
    height: 36px;
    flex: 0 0 auto;
    border: 1px solid var(--td-hairline);
    border-radius: 7px;
    object-fit: cover;
  }

  .now-playing__thumb {
    display: block;
    background: repeating-linear-gradient(120deg, #34302c 0 7px, #2a2723 7px 14px);
  }

  .now-playing__text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .now-playing__text strong,
  .now-playing__text span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now-playing__text strong {
    font-size: 13px;
    font-weight: 650;
  }

  .now-playing__text span {
    color: #8f897f;
    font-size: 11.5px;
  }

  .playback-center {
    display: flex;
    min-width: 0;
    align-items: center;
    flex-direction: column;
    gap: 6px;
  }

  .transport-controls {
    display: flex;
    align-items: center;
    gap: 17px;
  }

  .icon-button,
  .play-button,
  .volume-control__button {
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    color: var(--td-text-soft);
    background: transparent;
  }

  .icon-button:hover {
    color: var(--td-text);
    background: #27231e;
  }

  .icon-button svg {
    width: 17px;
    height: 17px;
    stroke-width: 1.7;
  }

  .play-button {
    width: 40px;
    height: 40px;
    color: #161410;
    background: var(--td-text);
    transition: transform 150ms ease, background-color 150ms ease;
  }

  .play-button:not(:disabled):hover {
    background: #fffdf8;
    transform: scale(1.05);
  }

  .play-button:active {
    transform: scale(0.98);
  }

  .play-button svg {
    width: 15px;
    height: 15px;
    stroke-width: 2.3;
  }

  .progress-control {
    display: grid;
    width: min(100%, 580px);
    grid-template-columns: 38px 1fr 42px;
    align-items: center;
    gap: 9px;
  }

  .progress-control time {
    color: #8f897f;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .progress-control time:first-child {
    text-align: right;
  }

  .range {
    width: 100%;
    height: 14px;
    margin: 0;
    border-radius: 999px;
    outline: none;
    background-color: transparent;
    background-image: linear-gradient(
      to right,
      var(--td-accent) 0 var(--range-progress),
      var(--td-border-strong) var(--range-progress) 100%
    );
    background-position: center;
    background-repeat: no-repeat;
    background-size: 100% 4px;
    cursor: pointer;
    appearance: none;
  }

  .range::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: transparent;
  }

  .range::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border: 0;
    border-radius: 50%;
    background: #e8e4dc;
    box-shadow: 0 1px 4px rgb(0 0 0 / 40%);
    appearance: none;
  }

  .range::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: transparent;
  }

  .range::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    border-radius: 50%;
    background: #e8e4dc;
  }

  .range:focus-visible {
    outline-offset: 2px;
  }

  .volume-control {
    display: grid;
    grid-template-columns: 28px 1fr;
    align-items: center;
    gap: 8px;
  }

  .volume-control__button {
    width: 28px;
    height: 28px;
    color: #8f897f;
    background: transparent;
  }

  .volume-control__button:hover {
    color: var(--td-text);
    background: #27231e;
  }

  .volume-control__button svg {
    width: 17px;
    height: 17px;
    stroke-width: 1.6;
  }

  .icon-button--mode {
    position: relative;
  }

  .icon-button--mode svg {
    width: 15px;
    height: 15px;
  }

  .icon-button--on {
    color: var(--td-accent);
  }

  .icon-button--on:hover {
    color: var(--td-accent-hover);
  }

  .icon-button--on::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: currentColor;
    transform: translateX(-50%);
  }

  @media (max-width: 1080px) {
    .playback-bar {
      grid-template-columns: 220px minmax(280px, 1fr) 145px;
      gap: 18px;
    }
  }

  @media (max-width: 900px) {
    .playback-bar {
      grid-template-columns: minmax(260px, 1fr) 132px;
      gap: 16px;
      padding-inline: 16px;
    }

    .now-playing {
      display: none;
    }

    .playback-center {
      grid-column: 1;
    }

    .volume-control {
      grid-column: 2;
    }
  }

  @media (max-width: 620px) {
    .playback-bar {
      grid-template-columns: minmax(220px, 1fr) 74px;
      gap: 8px;
      padding-inline: 10px;
    }

    .transport-controls {
      gap: 12px;
    }

    .progress-control {
      grid-template-columns: 33px 1fr 37px;
      gap: 6px;
    }

    .volume-control {
      grid-template-columns: 24px 1fr;
      gap: 4px;
    }

    .volume-control__button {
      width: 24px;
    }
  }
`
