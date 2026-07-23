import { CassetteTape, Check, ChevronDown, History, Plus } from 'lucide-react'
import { useState } from 'react'
import { Playlist, thumbnailUrl } from '../data/mockPlaylist'
import { useDismiss } from '../hooks/useDismiss'
import type { Mixtape, SavedSource } from '../lib/library'

type SourceSwitcherProps = {
  playlist: Playlist
  mixtapes: Mixtape[]
  sources: SavedSource[]
  activeMixtapeId?: string | null
  onSelectSource: (url: string) => void
  onSelectMixtape: (mixtapeId: string) => void
  onChangeSource: () => void
}

export function SourceSwitcher({
  playlist,
  mixtapes,
  sources,
  activeMixtapeId,
  onSelectSource,
  onSelectMixtape,
  onChangeSource,
}: SourceSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false), open)

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="source-card" ref={ref}>
      <button
        type="button"
        className="source-card__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Switch from ${playlist.name}`}
      >
        <img className="source-card__art" src={playlist.thumbnail || thumbnailUrl(playlist.tracks[0].id)} alt="" />
        <div className="source-card__copy">
          <strong>{playlist.name}</strong>
          <span>{playlist.kind} · {playlist.tracks.length} videos</span>
        </div>
        <ChevronDown className="source-card__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="source-switcher" role="listbox">
          {mixtapes.length > 0 && (
            <>
              <p className="source-switcher__label">Mixtapes</p>
              {mixtapes.map((mixtape) => {
                const cover = mixtape.tracks.find((entry) => !entry.unavailable)
                const active = activeMixtapeId === mixtape.id
                return (
                  <button
                    key={mixtape.id}
                    type="button"
                    className="source-switcher__row"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(() => onSelectMixtape(mixtape.id))}
                  >
                    <span className="source-switcher__thumb">
                      {cover ? (
                        <img src={thumbnailUrl(cover.id)} alt="" loading="lazy" />
                      ) : (
                        <CassetteTape aria-hidden="true" />
                      )}
                    </span>
                    <span className="source-switcher__copy">
                      <strong>{mixtape.name}</strong>
                      <span>{mixtape.tracks.length} {mixtape.tracks.length === 1 ? 'track' : 'tracks'}</span>
                    </span>
                    {active && <Check className="source-switcher__check" aria-hidden="true" />}
                  </button>
                )
              })}
            </>
          )}

          {sources.length > 0 && (
            <>
              <p className="source-switcher__label">Saved</p>
              {sources.map((source) => {
                const active = !activeMixtapeId && playlist.sourceUrl === source.url
                return (
                  <button
                    key={source.url}
                    type="button"
                    className="source-switcher__row"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(() => onSelectSource(source.url))}
                  >
                    <span className="source-switcher__thumb">
                      {source.thumbnail ? (
                        <img src={source.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <History aria-hidden="true" />
                      )}
                    </span>
                    <span className="source-switcher__copy">
                      <strong>{source.name}</strong>
                      <span>{source.tracks.length} {source.tracks.length === 1 ? 'track' : 'tracks'}</span>
                    </span>
                    {active && <Check className="source-switcher__check" aria-hidden="true" />}
                  </button>
                )
              })}
            </>
          )}

          <div className="source-switcher__divider" />
          <button
            type="button"
            className="source-switcher__row source-switcher__row--new"
            onClick={() => choose(onChangeSource)}
          >
            <Plus aria-hidden="true" /> Load a new URL…
          </button>
        </div>
      )}
    </div>
  )
}
