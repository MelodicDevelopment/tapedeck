import { CassetteTape, Check, Plus, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Track } from '../data/mockPlaylist'
import { Mixtape, mixtapeHasTrack } from '../lib/library'

type MixtapePickerProps = {
  track: Track
  mixtapes: Mixtape[]
  onToggle: (mixtapeId: string, track: Track) => void
  onCreate: (name: string, track: Track) => void
  onClose: () => void
}

export function MixtapePicker({ track, mixtapes, onToggle, onCreate, onClose }: MixtapePickerProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed, track)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Add “${track.title}” to a mixtape`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div className="modal__title">
            <strong>Add to mixtape</strong>
            <span>{track.title}</span>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </header>

        {mixtapes.length > 0 ? (
          <ul className="mixtape-options">
            {mixtapes.map((mixtape) => {
              const added = mixtapeHasTrack(mixtape, track.id)
              return (
                <li key={mixtape.id}>
                  <button
                    type="button"
                    className={`mixtape-option${added ? ' mixtape-option--added' : ''}`}
                    onClick={() => onToggle(mixtape.id, track)}
                    aria-pressed={added}
                  >
                    <CassetteTape aria-hidden="true" />
                    <span className="mixtape-option__copy">
                      <strong>{mixtape.name}</strong>
                      <span>{mixtape.tracks.length} {mixtape.tracks.length === 1 ? 'video' : 'videos'}</span>
                    </span>
                    {added && <Check className="mixtape-option__check" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mixtape-options__empty">
            No mixtapes yet. Name your first one below and this video starts it off.
          </p>
        )}

        <form className="mixtape-create" onSubmit={handleCreate}>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New mixtape name"
            aria-label="New mixtape name"
            autoFocus={mixtapes.length === 0}
            maxLength={80}
          />
          <button className="button button--primary" type="submit" disabled={!name.trim()}>
            <Plus aria-hidden="true" /> Create
          </button>
        </form>
      </div>
    </div>
  )
}
