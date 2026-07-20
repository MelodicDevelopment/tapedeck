import { AlertCircle, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { FormEvent } from 'react'
import type { AuthStatus } from '../api/auth'
import { Brand } from './Brand'

type WelcomeScreenProps = {
  url: string
  error: string
  loading: boolean
  desktop: boolean
  authStatus: AuthStatus | null
  authAction: 'sign-in' | 'sign-out' | null
  onUrlChange: (value: string) => void
  onSubmit: () => void
  onSignIn: () => void
  onSignOut: () => void
  onOpenDemo: () => void
}

const EXAMPLE_URL = 'https://www.youtube.com/@lofihiphopmusic'

export function WelcomeScreen({
  url,
  error,
  loading,
  desktop,
  authStatus,
  authAction,
  onUrlChange,
  onSubmit,
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
                      youtube.com/@lofihiphopmusic
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
        )}
      </section>

      <footer className="welcome-footer">
        Plays videos directly from <strong>YouTube</strong>
        <span aria-hidden="true"> · </span>
        nothing is downloaded
      </footer>
    </main>
  )
}
