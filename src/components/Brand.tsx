import { useId } from 'react'

type BrandProps = {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  // Unique per instance: the compact player-header mark and the regular
  // welcome-header mark can both be mounted at once (the player stays
  // mounted behind the Welcome overlay), and gradient ids must not collide.
  const gradientId = `tdac-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const size = compact ? 34 : 40

  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`} aria-label="Tapedeck home">
      <svg className="brand__mark" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b6acf8" />
            <stop offset="1" stopColor="#7263e7" />
          </linearGradient>
        </defs>
        <circle cx="512" cy="512" r="320" fill="none" stroke={`url(#${gradientId})`} strokeWidth="44" />
        <circle cx="512" cy="512" r="228" fill="none" stroke={`url(#${gradientId})`} strokeWidth="26" strokeDasharray="34 58" />
        <circle cx="512" cy="512" r="148" fill={`url(#${gradientId})`} />
        <path d="M474 442 L600 512 L474 582 Z" fill="#14110e" stroke="#14110e" strokeWidth="40" strokeLinejoin="round" />
      </svg>
      <span>Tapedeck</span>
    </div>
  )
}
