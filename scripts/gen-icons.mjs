// Generates src/ui/icons.ts from lucide-static SVGs so the converted app keeps
// the exact same icon artwork lucide-react rendered.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = '/Users/rick.hopkins/Source/MelodicDevelopment/products/tapedeck'

// lucide-react name -> lucide-static kebab file name
const ICONS = {
  alertCircle: 'circle-alert',
  arrowLeft: 'arrow-left',
  cassetteTape: 'cassette-tape',
  check: 'check',
  chevronDown: 'chevron-down',
  circleOff: 'circle-off',
  cloud: 'cloud',
  cloudOff: 'cloud-off',
  copy: 'copy',
  download: 'download',
  gripVertical: 'grip-vertical',
  helpCircle: 'circle-help',
  history: 'history',
  laptop: 'laptop',
  listMusic: 'list-music',
  listPlus: 'list-plus',
  loaderCircle: 'loader-circle',
  logOut: 'log-out',
  minus: 'minus',
  music: 'music',
  pause: 'pause',
  play: 'play',
  plus: 'plus',
  refreshCw: 'refresh-cw',
  repeat: 'repeat',
  repeat1: 'repeat-1',
  search: 'search',
  shieldCheck: 'shield-check',
  shuffle: 'shuffle',
  skipBack: 'skip-back',
  skipForward: 'skip-forward',
  square: 'square',
  target: 'target',
  triangleAlert: 'triangle-alert',
  upload: 'upload',
  video: 'video',
  volume1: 'volume-1',
  volume2: 'volume-2',
  volumeX: 'volume-x',
  x: 'x',
  youtube: 'youtube',
}

const entries = Object.entries(ICONS).map(([name, file]) => {
  const svg = readFileSync(
    resolve(ROOT, 'node_modules/lucide-static/icons', `${file}.svg`),
    'utf8',
  )
  // Everything between <svg ...> and </svg> — the paths only.
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\n\s*/g, ' ')
    .trim()
  return `  ${name}: '${inner.replace(/'/g, "\\'")}',`
})

const out = `// Inline Lucide icon artwork (ISC licensed), extracted from lucide-static so
// the Melodic build renders the exact same icons the React build did.
// Regenerate with scripts/gen-icons.mjs if the icon set ever changes.

const PATHS: Record<string, string> = {
${entries.join('\n')}
}

export type IconName = keyof typeof PATHS

type IconOptions = {
  class?: string
  size?: number
  /** Fill with currentColor (lucide-react's fill="currentColor"). */
  fill?: boolean
}

/**
 * A Lucide icon as a raw SVG string — render with unsafeHTML() inside a
 * Melodic template. Matches lucide-react's output: 24x24 viewBox, stroke
 * currentColor, stroke-width 2, round caps/joins.
 */
export function icon(name: IconName, options: IconOptions = {}): string {
  const size = options.size ?? 24
  const cls = options.class ? \` class="\${options.class}"\` : ''
  const fill = options.fill ? 'currentColor' : 'none'
  return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="\${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\${cls} aria-hidden="true">\${PATHS[name]}</svg>\`
}
`

writeFileSync(resolve(ROOT, 'src/ui/icons.ts'), out)
console.log(`wrote src/ui/icons.ts with ${Object.keys(ICONS).length} icons`)
