import { MelodicComponent } from '@melodicdev/core'
import { brandTemplate } from './brand.template'
import { brandStyles } from './brand.styles'

let brandSequence = 0

/**
 * td-brand — the Tapedeck wordmark and reel logo.
 *
 * @example
 * ```html
 * <td-brand></td-brand>
 * <td-brand compact></td-brand>
 * ```
 */
@MelodicComponent({
  selector: 'td-brand',
  template: brandTemplate,
  styles: brandStyles,
  attributes: ['compact'],
})
export class BrandComponent {
  public compact = false

  // Unique per instance: the compact player-header mark and the regular
  // welcome-header mark can both be mounted at once (the player stays
  // mounted behind the Welcome overlay), and gradient ids must not collide.
  public readonly gradientId: string = `tdac-${++brandSequence}`
}
