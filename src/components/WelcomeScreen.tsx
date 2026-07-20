import { AlertCircle, CassetteTape, History, LoaderCircle, LogOut, ShieldCheck, X } from 'lucide-react'
import { FormEvent } from 'react'
import type { AuthStatus } from '../api/auth'
import { thumbnailUrl } from '../data/mockPlaylist'
import type { Mixtape, SavedSource } from '../lib/library'
import { Brand } from './Brand'

type WelcomeScreenProps = {
  url: string
  error: string
  loading: boolean
  desktop: boolean
  authStatus: AuthStatus | null
  authAction: 'sign-in' | 'sign-out' | null
  sources: SavedSource[]
  mixtapes: Mixtape[]
  onUrlChange: (value: string) => void
  onSubmit: () => void
  onOpenSource: (url: string) => void
  onRemoveSource: (url: string) => void
  onPlayMixtape: (id: string) => void
  onDeleteMixtape: (id: string) => void
  onSignIn: () => void
  onSignOut: () => void
  onOpenDemo: () => void
}

const EXAMPLE_URL = 'https://www.youtube.com/@LofiGirl'

export function WelcomeScreen({
  url,
  error,
  loading,
  desktop,
  authStatus,
  authAction,
  sources,
  mixtapes,
  onUrlChange,
  onSubmit,
  onOpenSource,
  onRemoveSource,
  onPlayMixtape,
  onDeleteMixtape,
  onSignIn,
  onSignOut,
  onOpenDemo,
}: WelcomeScreenProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  const checkingAuth = desktop && authStatus === null
  const needsSignIn = desktop && !authStatus?.authenticated
  const signingIn = authAction === 'sign-in'

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        {desktop && authStatus?.authenticated && authStatus.user && (
          <div className="account-summary">
            {authStatus.user.picture ? (
              <img src={authStatus.user.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="account-summary__avatar" aria-hidden="true">
                {authStatus.user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="account-summary__copy">
              <strong>{authStatus.user.name}</strong>
              <span>{authStatus.user.email}</span>
            </span>
            <button
              type="button"
              className="account-summary__sign-out"
              onClick={onSignOut}
              disabled={authAction !== null}
              aria-label="Sign out of Google"
              title="Sign out"
            >
              {authAction === 'sign-out' ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            </button>
          </div>
        )}
      </header>

      <section className="welcome-content" aria-live="polite">
        <div className="welcome-stack">
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
        ) : (
          <>
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
                        : 'This development build is missing its Google OAuth client credentials in .env. The demo still works.'}
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

            <form onSubmit={handleSubmit} className="source-form" noValidate>
              <div className="source-form__row">
                <input
                  className={error ? 'input input--error' : 'input'}
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="https://www.youtube.com/…"
                  aria-label="YouTube channel or playlist URL"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'source-error' : 'source-helper'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={needsSignIn || authAction !== null}
                />
                <button className="button button--primary" type="submit" disabled={needsSignIn || authAction !== null}>
                  Load
                </button>
              </div>

              {error ? (
                <div className="source-form__feedback">
                  <p className="source-form__error" id="source-error" role="alert">
                    <AlertCircle aria-hidden="true" />
                    {error}
                  </p>
                  <button className="demo-link" type="button" onClick={onOpenDemo}>
                    Open the demo playlist instead
                  </button>
                </div>
              ) : (
                <div className="source-form__helpers" id="source-helper">
                  <p className="source-form__helper">
                    Try{' '}
                    <button type="button" onClick={() => onUrlChange(EXAMPLE_URL)}>
                      youtube.com/@LofiGirl
                    </button>
                  </p>
                  <span aria-hidden="true">or</span>
                  <button className="demo-link" type="button" onClick={onOpenDemo}>
                    Preview the demo playlist
                  </button>
                </div>
              )}
            </form>
          </div>

          {(mixtapes.length > 0 || sources.length > 0) && (
            <section className="library" aria-label="Your library">
              {mixtapes.length > 0 && (
                <div className="library__group">
                  <h2 className="library__heading">
                    <CassetteTape aria-hidden="true" /> Your mixtapes
                  </h2>
                  <ul className="library__list">
                    {mixtapes.map((mixtape) => {
                      const cover = mixtape.tracks.find((track) => !track.unavailable)
                      const count = mixtape.tracks.length
                      return (
                        <li key={mixtape.id} className="library-card">
                          <button
                            type="button"
                            className="library-card__main"
                            onClick={() => onPlayMixtape(mixtape.id)}
                            disabled={count === 0}
                          >
                            {cover ? (
                              <img src={thumbnailUrl(cover.id)} alt="" loading="lazy" />
                            ) : (
                              <span className="library-card__placeholder" aria-hidden="true">
                                <CassetteTape />
                              </span>
                            )}
                            <span className="library-card__copy">
                              <strong>{mixtape.name}</strong>
                              <span>{count} {count === 1 ? 'video' : 'videos'} · Mixtape</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="library-card__remove"
                            onClick={() => onDeleteMixtape(mixtape.id)}
                            aria-label={`Delete mixtape ${mixtape.name}`}
                            title="Delete mixtape"
                          >
                            <X aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {sources.length > 0 && (
                <div className="library__group">
                  <h2 className="library__heading">
                    <History aria-hidden="true" /> Saved channels &amp; playlists
                  </h2>
                  <ul className="library__list">
                    {sources.map((source) => (
                      <li key={source.url} className="library-card">
                        <button
                          type="button"
                          className="library-card__main"
                          onClick={() => onOpenSource(source.url)}
                          disabled={needsSignIn || authAction !== null}
                          title={source.url}
                        >
                          {source.thumbnail ? (
                            <img src={source.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="library-card__placeholder" aria-hidden="true">
                              <History />
                            </span>
                          )}
                          <span className="library-card__copy">
                            <strong>{source.name}</strong>
                            <span>{source.kind}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="library-card__remove"
                          onClick={() => onRemoveSource(source.url)}
                          aria-label={`Remove ${source.name} from saved sources`}
                          title="Remove from saved"
                        >
                          <X aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          </>
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
