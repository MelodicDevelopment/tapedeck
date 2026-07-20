import { Play } from 'lucide-react'

type BrandProps = {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`} aria-label="Tapedeck home">
      <span className="brand__mark" aria-hidden="true">
        <Play fill="currentColor" />
      </span>
      <span>Tapedeck</span>
    </div>
  )
}
