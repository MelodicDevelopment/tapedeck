import { html, type TemplateResult } from '@melodicdev/core'

/** Deliberately static — the component manages the YT iframe mount manually
 *  inside this container, so the template engine must never patch it. */
export function youTubePlayerTemplate(): TemplateResult {
  return html`<div class="youtube-player"></div>`
}
