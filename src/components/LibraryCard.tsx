import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type LibraryCardProps = {
  name: string
  meta: string
  thumbnail: string
  placeholder: ReactNode
  lastPlayed: boolean
  disabled?: boolean
  onOpen: () => void
  onRemove: () => void
  removeLabel: string
}

export function LibraryCard({
  name,
  meta,
  thumbnail,
  placeholder,
  lastPlayed,
  disabled,
  onOpen,
  onRemove,
  removeLabel,
}: LibraryCardProps) {
  return (
    <li className="library-grid__card">
      <button
        type="button"
        className="library-grid__art"
        onClick={onOpen}
        disabled={disabled}
        title={name}
        aria-label={name}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="library-grid__placeholder" aria-hidden="true">
            {placeholder}
          </span>
        )}
        {lastPlayed && <span className="library-grid__pill" aria-hidden="true">Last played</span>}
      </button>
      <button
        type="button"
        className="library-grid__remove"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
      >
        <X aria-hidden="true" />
      </button>
      <div className="library-grid__body">
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
    </li>
  )
}
