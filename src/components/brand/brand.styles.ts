import { css, type TemplateResult } from '@melodicdev/core'

export const brandStyles = (): TemplateResult => css`
  :host {
    display: contents;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .brand__mark {
    flex: 0 0 auto;
  }

  .brand--compact {
    font-size: 14px;
  }
`
