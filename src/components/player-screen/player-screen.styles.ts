import { css, type TemplateResult } from '@melodicdev/core'

export const playerScreenStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .loaded-shell {
    display: grid;
    height: calc(100vh - var(--td-titlebar-h));
    height: calc(100dvh - var(--td-titlebar-h));
    grid-template-rows: minmax(0, 1fr) 86px;
    overflow: hidden;
    background: var(--td-bg);
  }

  .player-workspace {
    display: flex;
    min-height: 0;
  }

  .queue-panel {
    display: flex;
    width: 318px;
    min-height: 0;
    flex: 0 0 318px;
    flex-direction: column;
    border-right: 1px solid #292621;
    background: var(--td-panel);
  }

  .queue-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 16px 7px;
    color: var(--td-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .queue-heading span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .queue-heading svg {
    width: 14px;
    height: 14px;
  }

  .queue-heading__jump {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    cursor: pointer;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    transition: color 120ms ease;
  }

  .queue-heading__jump:hover {
    color: var(--td-accent);
  }

  .track-list {
    min-height: 0;
    margin: 0;
    padding: 4px 8px 12px;
    overflow-y: auto;
    list-style: none;
  }

  .track-row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 11px;
    margin: 1px 0;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    cursor: pointer;
    text-align: left;
  }

  .track-row:hover {
    background: #242119;
  }

  .track-row:active {
    background: #29251e;
  }

  .track-row:focus-visible {
    outline-offset: -2px;
  }

  .track-row--current {
    border-color: rgb(139 127 240 / 10%);
    background: var(--td-raised);
  }

  .track-row__thumb {
    position: relative;
    display: block;
    width: 52px;
    height: 32px;
    flex: 0 0 auto;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 6%);
    border-radius: 6px;
    background: repeating-linear-gradient(120deg, #34302c 0 7px, #2a2723 7px 14px);
  }

  .track-row__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .track-row__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 3px;
  }

  .track-row__copy strong,
  .track-row__copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-row__copy strong {
    color: #e6e2da;
    font-size: 13px;
    font-weight: 550;
  }

  .track-row--current .track-row__copy strong {
    color: var(--td-accent-soft);
    font-weight: 650;
  }

  .track-row__copy strong.muted {
    color: var(--td-faint);
  }

  .track-row__copy span {
    color: #8f897f;
    font-size: 11.5px;
  }

  .track-row__badge {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 6px;
    border-radius: 5px;
    color: var(--td-accent);
    background: var(--td-accent-dim);
    font-size: 10.5px;
    font-weight: 700;
  }

  .track-row--current .track-row__badge--current {
    color: #14120f;
    background: var(--td-accent);
  }

  .track-row > time {
    flex: 0 0 auto;
    color: var(--td-faint);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }

  .playing-bars {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgb(17 15 13 / 62%);
  }

  .playing-bars i {
    width: 3px;
    height: 11px;
    border-radius: 2px;
    background: var(--td-accent-soft);
  }

  .playing-bars--active i {
    animation: equalize 900ms ease-in-out infinite alternate;
  }

  .playing-bars i:nth-child(2) {
    height: 7px;
    animation-delay: -450ms;
  }

  .playing-bars i:nth-child(3) {
    height: 9px;
    animation-delay: -200ms;
  }

  .player-panel {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    overflow-y: auto;
  }

  .player-header {
    display: grid;
    align-items: center;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    padding: 18px 32px 0;
  }

  .mode-toggle {
    display: flex;
    justify-self: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--td-border);
    border-radius: 10px;
    background: var(--td-well);
  }

  .mode-toggle__option {
    display: inline-flex;
    height: 28px;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border: 0;
    border-radius: 7px;
    color: var(--td-faint);
    background: transparent;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .mode-toggle__option svg {
    width: 14px;
    height: 14px;
  }

  .mode-toggle__option--active {
    color: var(--td-text);
    background: #33302b;
  }

  .player-header__left {
    display: flex;
    align-items: center;
    justify-self: start;
    gap: 14px;
  }

  .player-header__back {
    display: inline-flex;
    height: 32px;
    align-items: center;
    gap: 7px;
    padding: 0 13px;
    border: 1px solid var(--td-border);
    border-radius: 10px;
    color: var(--td-muted);
    background: transparent;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .player-header__back:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .player-header__back svg {
    width: 14px;
    height: 14px;
  }

  .player-header__right {
    display: flex;
    align-items: center;
    justify-self: end;
    gap: 14px;
  }

  .player-header__icon-button {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border: 1px solid var(--td-border);
    border-radius: 8px;
    color: var(--td-muted);
    background: transparent;
    cursor: pointer;
  }

  .player-header__icon-button:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .player-header__icon-button svg {
    width: 15px;
    height: 15px;
  }

  .youtube-source {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--td-faint);
    font-size: 12px;
  }

  .youtube-source svg {
    width: 17px;
    height: 17px;
    color: var(--td-youtube);
  }

  .player-stage {
    display: flex;
    width: 100%;
    min-height: 0;
    flex: 1;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    margin: 0 auto;
    padding: 20px 36px 26px;
    --stage-video-width: 100%;
  }

  /* Let the video grow with the window: as wide as the stage allows, but
     never taller than the space left after the track details (96px). The
     stacked <=900px layout keeps width-driven sizing. */
  @media (min-width: 901px) {
    @supports (width: 1cqh) {
      .player-stage {
        container-type: size;
        --stage-video-width: min(100%, calc((100cqh - 96px) * 16 / 9));
      }
    }
  }

  .video-frame {
    position: relative;
    width: var(--stage-video-width);
    aspect-ratio: 16 / 9;
    flex: 0 0 auto;
    overflow: hidden;
    border: 1px solid var(--td-border);
    border-radius: 14px;
    background: #0f0e0c;
    box-shadow: 0 10px 34px rgb(0 0 0 / 32%);
  }

  /* Kept mounted (not display:none) so playback continues uninterrupted
     while Audio mode's art + reel are shown instead. */
  .video-frame--hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .audio-mode {
    display: flex;
    width: 100%;
    max-width: 720px;
    align-items: center;
    justify-content: center;
    gap: 44px;
    margin: auto;
  }

  .audio-mode__art {
    position: relative;
    width: 270px;
    height: 270px;
    flex: 0 0 auto;
    overflow: hidden;
    border-radius: 18px;
    background: #0f0e0c;
    box-shadow: 0 18px 50px rgb(0 0 0 / 50%);
  }

  .audio-mode__art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .audio-mode__reel {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    animation: reel-spin 3.2s linear infinite;
    animation-play-state: paused;
  }

  .audio-mode__reel--spinning {
    animation-play-state: running;
  }

  .audio-mode__reel-ring {
    width: 92px;
    height: 92px;
    border: 2px dashed rgb(255 255 255 / 30%);
    border-radius: 50%;
    background: rgb(20 18 15 / 55%);
  }

  .audio-mode__reel-hub {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgb(255 255 255 / 55%);
  }

  .audio-mode__copy {
    display: flex;
    min-width: 0;
    max-width: 340px;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .audio-mode__copy h1 {
    margin: 4px 0 0;
    overflow: hidden;
    font-size: 23px;
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
  }

  .audio-mode__copy > p {
    margin: 0;
    overflow: hidden;
    color: var(--td-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .audio-mode__show-video {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 4px 14px 4px 4px;
    border: 1px solid var(--td-border-strong);
    border-radius: 20px;
    background: transparent;
    color: var(--td-text);
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    transition: border-color 120ms ease;
  }

  .audio-mode__show-video:hover {
    border-color: var(--td-accent);
  }

  .audio-mode__show-video img {
    width: 46px;
    height: 28px;
    border-radius: 14px;
    object-fit: cover;
  }

  .video-frame--unavailable {
    background:
      linear-gradient(rgb(15 14 12 / 91%), rgb(15 14 12 / 94%)),
      repeating-linear-gradient(120deg, #332f2a 0 12px, #292622 12px 24px);
  }

  .unavailable-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 24px;
    text-align: center;
  }

  .unavailable-state > svg {
    width: 36px;
    height: 36px;
    margin-bottom: 13px;
    color: var(--td-faint);
    stroke-width: 1.4;
  }

  .unavailable-state h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }

  .unavailable-state p {
    max-width: 340px;
    margin: 0 0 13px;
    color: var(--td-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .track-details {
    display: flex;
    width: var(--stage-video-width);
    min-width: 0;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
  }

  .track-details > div {
    min-width: 0;
  }

  .track-details h1 {
    margin: 5px 0 4px;
    overflow: hidden;
    font-size: clamp(18px, 2vw, 21px);
    font-weight: 650;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-details__meta {
    margin: 0;
    color: var(--td-muted);
    font-size: 13px;
  }

  .track-details__meta span {
    margin: 0 3px;
    color: var(--td-faint);
  }

  .track-details h1 a,
  .track-details__meta a,
  .audio-mode__copy h1 a,
  .audio-mode__copy > p a {
    color: inherit;
    text-decoration: none;
  }

  .track-details h1 a:hover,
  .track-details__meta a:hover,
  .audio-mode__copy h1 a:hover,
  .audio-mode__copy > p a:hover {
    text-decoration: underline;
  }

  .track-details__loading {
    width: 11px;
    height: 11px;
  }

  .track-details__back-to-queue {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--td-accent-soft);
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    transition: color 120ms ease;
  }

  .track-details__back-to-queue svg {
    width: 12px;
    height: 12px;
  }

  .track-details__back-to-queue:hover {
    color: var(--td-accent);
  }

  .track-details__jump {
    flex: 0 0 auto;
    padding: 0 0 2px;
    border: 0;
    background: transparent;
    color: var(--td-faint);
    cursor: pointer;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    transition: color 120ms ease;
  }

  .track-details__jump:hover {
    color: var(--td-accent);
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .track-item .track-row {
    min-width: 0;
    flex: 1;
  }

  .track-item__action {
    display: grid;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 7px;
    color: var(--td-faint);
    background: transparent;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
  }

  .track-item--hovered .track-item__action,
  .track-item:focus-within .track-item__action {
    opacity: 1;
  }

  .track-item__action:hover {
    color: var(--td-text);
    background: var(--td-raised);
  }

  .track-item__action svg {
    width: 15px;
    height: 15px;
  }

  .track-item__grip {
    display: grid;
    width: 18px;
    flex: 0 0 auto;
    place-items: center;
    color: var(--td-faint);
    cursor: grab;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .track-item:hover .track-item__grip,
  .track-item:focus-within .track-item__grip {
    opacity: 1;
  }

  .track-item__grip svg {
    width: 14px;
    height: 14px;
  }

  .track-item--drag-over {
    border-radius: 10px;
    box-shadow: inset 0 2px 0 var(--td-accent);
  }

  @media (max-width: 1080px) {
    .queue-panel {
      width: 292px;
      flex-basis: 292px;
    }

    .player-stage {
      padding-inline: 28px;
    }
  }

  @media (max-width: 900px) {
    .loaded-shell {
      grid-template-rows: minmax(0, 1fr) 96px;
    }

    .player-workspace {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .player-panel {
      order: 1;
      overflow: visible;
    }

    .queue-panel {
      width: 100%;
      min-height: 410px;
      max-height: 440px;
      flex: 0 0 410px;
      order: 2;
      border-top: 1px solid #292621;
      border-right: 0;
    }

    .player-stage {
      flex: none;
      padding-top: 24px;
      padding-bottom: 28px;
    }
  }

  @media (max-width: 620px) {
    .player-header {
      padding: 16px 18px 0;
    }

    .youtube-source {
      font-size: 11px;
    }

    .youtube-source svg {
      width: 15px;
    }

    .player-stage {
      gap: 16px;
      padding: 18px 14px 24px;
    }

    .video-frame {
      border-radius: 10px;
    }

    .track-details {
      align-items: flex-start;
    }

    .track-details__label {
      display: none;
    }

    .track-details h1 {
      margin-top: 0;
    }

    .track-details > span {
      padding-top: 4px;
    }

    .loaded-shell {
      grid-template-rows: minmax(0, 1fr) 100px;
    }
  }
`
