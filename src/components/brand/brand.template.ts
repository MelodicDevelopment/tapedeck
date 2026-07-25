import { html, type TemplateResult } from '@melodicdev/core'
import type { BrandComponent } from './brand.component'

export function brandTemplate(c: BrandComponent): TemplateResult {
  const size = c.compact ? 34 : 40
  const fill = `url(#${c.gradientId})`
  return html`
    <div class=${c.compact ? 'brand brand--compact' : 'brand'} aria-label="Tapedeck home">
      <svg class="brand__mark" width=${size} height=${size} viewBox="0 0 1024 1024" aria-hidden="true">
        <defs>
          <linearGradient id=${c.gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#b6acf8" />
            <stop offset="1" stop-color="#7263e7" />
          </linearGradient>
        </defs>
        <circle cx="512" cy="512" r="320" fill="none" stroke=${fill} stroke-width="44" />
        <circle cx="512" cy="512" r="228" fill="none" stroke=${fill} stroke-width="26" stroke-dasharray="34 58" />
        <circle cx="512" cy="512" r="148" fill=${fill} />
        <path d="M474 442 L600 512 L474 582 Z" fill="#14110e" stroke="#14110e" stroke-width="40" stroke-linejoin="round" />
      </svg>
      <span>Tapedeck</span>
    </div>
  `
}
