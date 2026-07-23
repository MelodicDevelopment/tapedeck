import {
  AlertCircle,
  ArrowLeft,
  CassetteTape,
  Download,
  History,
  LoaderCircle,
  Play,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { ChangeEvent, FormEvent, useRef, useState } from 'react'
import type { AuthStatus } from '../api/auth'
import type { SyncedDevice } from '../api/sync'
import { formatTime, thumbnailUrl } from '../data/mockPlaylist'
import type { Mixtape, SavedSource } from '../lib/library'
import { formatRelativeTime } from '../lib/time'
import { AccountSummary } from './AccountSummary'
import { Brand } from './Brand'
import { LibraryCard } from './LibraryCard'
import { SyncChip, type SyncStatus } from './SyncChip'

type WelcomeScreenProps = {
  url: string
  error: string
  loading: boolean
  desktop: boolean
  authStatus: AuthStatus | null
  authAction: 'sign-in' | 'sign-out' | null
  sources: SavedSource[]
  mixtapes: Mixtape[]
  overlay?: boolean
  onClose?: () => void
  syncStatus: SyncStatus
  syncDevices: SyncedDevice[]
  syncError: string
  onSyncNow: () => void
  onUrlChange: (value: string) => void
  onSubmit: () => void
  onOpenSource: (url: string) => void
  onRemoveSource: (url: string) => void
  onPlayMixtape: (id: string) => void
  onDeleteMixtape: (id: string) => void
  onExportLibrary: () => Promise<boolean>
  onImportLibrary: (parsed: unknown) => void
  onSignIn: () => void
  onSignOut: () => void
}

const EXAMPLE_URL = 'https://www.youtube.com/@METAL_MUSIC_AI'

type LibraryEntry =
  | { type: 'source'; key: string; data: SavedSource }
  | { type: 'mixtape'; key: string; data: Mixtape }

function entrySortTimestamp(entry: LibraryEntry): string {
  return entry.data.lastPlayedAt ?? (entry.type === 'source' ? entry.data.savedAt : entry.data.createdAt)
}

function entryThumbnail(entry: LibraryEntry): string {
  if (entry.type === 'source') {
    if (entry.data.thumbnail) return entry.data.thumbnail
  }
  const cover = entry.data.tracks.find((track) => !track.unavailable)
  return cover ? thumbnailUrl(cover.id) : ''
}

function entryMeta(entry: LibraryEntry): string {
  const count = entry.data.tracks.length
  const countLabel = `${count} ${count === 1 ? 'track' : 'tracks'}`
  const relative = entry.data.lastPlayedAt
    ? formatRelativeTime(entry.data.lastPlayedAt)
    : entry.type === 'source'
      ? entry.data.kind
      : 'Mixtape'
  return `${countLabel} · ${relative}`
}

export function WelcomeScreen({
  url,
  error,
  loading,
  desktop,
  authStatus,
  authAction,
  sources,
  mixtapes,
  overlay = false,
  onClose,
  syncStatus,
  syncDevices,
  syncError,
  onSyncNow,
  onUrlChange,
  onSubmit,
  onOpenSource,
  onRemoveSource,
  onPlayMixtape,
  onDeleteMixtape,
  onExportLibrary,
  onImportLibrary,
  onSignIn,
  onSignOut,
}: WelcomeScreenProps) {
  const [libraryQuery, setLibraryQuery] = useState('')
  const [importError, setImportError] = useState('')
  const [exportError, setExportError] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setExportError('')
    setImportError('')
    file
      .text()
      .then((text) => onImportLibrary(JSON.parse(text)))
      .catch(() => setImportError('That file isn’t a valid Tapedeck library export.'))
  }

  function handleExport() {
    setImportError('')
    setExportError('')
    onExportLibrary().catch(() => setExportError('Tapedeck could not export your library.'))
  }

  function openEntry(entry: LibraryEntry) {
    if (entry.type === 'source') onOpenSource(entry.data.url)
    else onPlayMixtape(entry.data.id)
  }

  function removeEntry(entry: LibraryEntry) {
    if (entry.type === 'source') onRemoveSource(entry.data.url)
    else onDeleteMixtape(entry.data.id)
  }

  const hasLibrary = sources.length > 0 || mixtapes.length > 0
  const allEntries: LibraryEntry[] = [
    ...sources.map((data): LibraryEntry => ({ type: 'source', key: `source:${data.url}`, data })),
    ...mixtapes.map((data): LibraryEntry => ({ type: 'mixtape', key: `mixtape:${data.id}`, data })),
  ].sort((a, b) => (entrySortTimestamp(a) < entrySortTimestamp(b) ? 1 : -1))

  const query = libraryQuery.trim().toLowerCase()
  const filteredEntries = query
    ? allEntries.filter((entry) => entry.data.name.toLowerCase().includes(query))
    : allEntries
  const noMatches = query.length > 0 && filteredEntries.length === 0

  const continueEntry = allEntries.find(
    (entry) => entry.data.lastPlayedAt && entry.data.lastTrackId && entry.data.lastPositionSecs != null,
  )
  const continueTrack = continueEntry?.data.tracks.find((track) => track.id === continueEntry.data.lastTrackId)
  const continueElapsed = continueEntry?.data.lastPositionSecs ?? 0
  const continueProgress =
    continueTrack && continueTrack.duration > 0
      ? Math.min(100, (continueElapsed / continueTrack.duration) * 100)
      : 0

  const checkingAuth = desktop && authStatus === null
  const needsSignIn = desktop && !authStatus?.authenticated
  const signingIn = authAction === 'sign-in'
  const formDisabled = needsSignIn || authAction !== null

  const pasteForm = (
    <form onSubmit={handleSubmit} className="source-form" noValidate>
      <div className="source-form__row">
        <input
          className={error ? 'input input--error' : 'input'}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste a YouTube channel or playlist URL…"
          aria-label="YouTube channel or playlist URL"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'source-error' : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={formDisabled}
        />
        <button className="button button--primary" type="submit" disabled={formDisabled}>
          Load
        </button>
      </div>
      {error && (
        <p className="source-form__error" id="source-error" role="alert">
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  )

  return (
    <main className={`welcome-shell${overlay ? ' welcome-shell--overlay' : ''}`}>
      <header className="welcome-header">
        <div className="welcome-header__left">
          <Brand />
          {overlay && (
            <button type="button" className="welcome-header__back" onClick={onClose}>
              <ArrowLeft aria-hidden="true" /> Back to player
            </button>
          )}
        </div>
        <div className="welcome-header__right">
          {desktop ? (
            <SyncChip
              status={syncStatus}
              devices={syncDevices}
              errorMessage={syncError}
              userEmail={authStatus?.user?.email}
              onSyncNow={onSyncNow}
              onExport={handleExport}
              onImportClick={() => importInputRef.current?.click()}
            />
          ) : (
            <div className="welcome-header__actions">
              <button
                type="button"
                className="welcome-header__icon-button"
                onClick={handleExport}
                disabled={!hasLibrary}
                aria-label="Export your library"
                title="Export library as JSON"
              >
                <Download aria-hidden="true" />
              </button>
              <button
                type="button"
                className="welcome-header__icon-button"
                onClick={() => importInputRef.current?.click()}
                aria-label="Import a library"
                title="Import library from JSON"
              >
                <Upload aria-hidden="true" />
              </button>
            </div>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="visually-hidden"
            onChange={handleImportFile}
          />
          <AccountSummary authStatus={authStatus} authAction={authAction} onSignOut={onSignOut} />
        </div>
      </header>
      {(importError || exportError) && (
        <p className="import-error" role="alert">
          <AlertCircle aria-hidden="true" />
          {importError || exportError}
        </p>
      )}

      <section className="welcome-content" aria-live="polite">
        <div className={`welcome-stack${hasLibrary ? ' welcome-stack--wide' : ''}`}>
        {checkingAuth ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="loading-state__spinner" aria-hidden="true" />
            <h1>Checking your Google sign-in…</h1>
            <p>Your login stays in the operating system credential vault.</p>
          </div>
        ) : loading ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="loading-state__spinner" aria-hidden="true" />
            <h1>Fetching from YouTube…</h1>
            <p>Reading the playlist and video titles. This usually takes a moment.</p>
          </div>
        ) : hasLibrary ? (
          <div className="welcome-library-view">
            <div className="compact-paste-bar">{pasteForm}</div>

            {needsSignIn && (
              <div className="auth-gate">
                <div className="auth-gate__copy">
                  <ShieldCheck aria-hidden="true" />
                  <div>
                    <strong>
                      {authStatus?.configured ? 'Connect your YouTube account' : 'Google sign-in needs configuration'}
                    </strong>
                    <span>
                      {authStatus?.configured
                        ? 'Sign in securely in your browser. Tapedeck requests read-only YouTube access.'
                        : 'This development build is missing its Google OAuth client credentials in .env.'}
                    </span>
                  </div>
                </div>
                <button
                  className="google-button"
                  type="button"
                  onClick={onSignIn}
                  disabled={!authStatus?.configured || signingIn}
                >
                  {signingIn ? (
                    <><LoaderCircle className="spin" aria-hidden="true" /> Finish in your browser…</>
                  ) : (
                    <><span className="google-button__mark" aria-hidden="true">G</span> Continue with Google</>
                  )}
                </button>
              </div>
            )}

            {continueEntry && continueTrack && (
              <div className="library__group">
                <p className="library__heading">Continue listening</p>
                <div className="continue-card">
                  <button
                    type="button"
                    className="continue-card__art"
                    onClick={() => openEntry(continueEntry)}
                    aria-label={`Resume ${continueEntry.data.name}`}
                  >
                    {entryThumbnail(continueEntry) ? (
                      <img src={entryThumbnail(continueEntry)} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="continue-card__placeholder" aria-hidden="true">
                        <Play />
                      </span>
                    )}
                    <span className="continue-card__play" aria-hidden="true"><Play fill="currentColor" /></span>
                  </button>
                  <div className="continue-card__copy">
                    <strong>{continueTrack.title}</strong>
                    <span>
                      {continueEntry.data.name} · {formatTime(continueElapsed)} of {formatTime(continueTrack.duration)}
                    </span>
                    <div className="continue-card__progress">
                      <div style={{ width: `${continueProgress}%` }} />
                    </div>
                  </div>
                  <button type="button" className="button button--primary button--small" onClick={() => openEntry(continueEntry)}>
                    Resume
                  </button>
                </div>
              </div>
            )}

            <section className="library" aria-label="Your library">
              <div className="library__group-header">
                <p className="library__heading">Your library · {allEntries.length} saved</p>
                <div className="library__search">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="Search library"
                    aria-label="Search your library"
                  />
                </div>
              </div>

              {noMatches ? (
                <p className="library__empty">No matches for “{libraryQuery.trim()}”.</p>
              ) : (
                <ul className="library-grid">
                  {filteredEntries.map((entry) => (
                    <LibraryCard
                      key={entry.key}
                      name={entry.data.name}
                      meta={entryMeta(entry)}
                      thumbnail={entryThumbnail(entry)}
                      placeholder={entry.type === 'mixtape' ? <CassetteTape /> : <History />}
                      lastPlayed={continueEntry?.key === entry.key}
                      disabled={entry.type === 'source' ? formDisabled : entry.data.tracks.length === 0}
                      onOpen={() => openEntry(entry)}
                      onRemove={() => removeEntry(entry)}
                      removeLabel={entry.type === 'source' ? `Remove ${entry.data.name} from saved sources` : `Delete mixtape ${entry.data.name}`}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="welcome-card">
            <p className="eyebrow">YOUR MUSIC, LESS NOISE</p>
            <h1>Play the channels you love</h1>
            <p className="welcome-card__copy">
              Paste a YouTube channel or playlist and Tapedeck turns it into a clean,
              distraction-free music player.
            </p>

            {needsSignIn && (
              <div className="auth-gate">
                <div className="auth-gate__copy">
                  <ShieldCheck aria-hidden="true" />
                  <div>
                    <strong>
                      {authStatus?.configured ? 'Connect your YouTube account' : 'Google sign-in needs configuration'}
                    </strong>
                    <span>
                      {authStatus?.configured
                        ? 'Sign in securely in your browser. Tapedeck requests read-only YouTube access.'
                        : 'This development build is missing its Google OAuth client credentials in .env.'}
                    </span>
                  </div>
                </div>
                <button
                  className="google-button"
                  type="button"
                  onClick={onSignIn}
                  disabled={!authStatus?.configured || signingIn}
                >
                  {signingIn ? (
                    <><LoaderCircle className="spin" aria-hidden="true" /> Finish in your browser…</>
                  ) : (
                    <><span className="google-button__mark" aria-hidden="true">G</span> Continue with Google</>
                  )}
                </button>
              </div>
            )}

            {pasteForm}

            {!error && (
              <div className="source-form__helpers">
                <p className="source-form__helper">
                  Try{' '}
                  <button type="button" onClick={() => onUrlChange(EXAMPLE_URL)}>
                    youtube.com/@METAL_MUSIC_AI
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      <footer className="welcome-footer">
        Plays videos directly from <strong>YouTube</strong>
        <span aria-hidden="true"> · </span>
        nothing is downloaded
      </footer>
    </main>
  )
}
