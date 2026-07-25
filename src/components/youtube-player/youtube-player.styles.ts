import { css, type TemplateResult } from '@melodicdev/core'

export const youTubePlayerStyles = (): TemplateResult => css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .youtube-player,
  .youtube-player div,
  .youtube-player iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
`
