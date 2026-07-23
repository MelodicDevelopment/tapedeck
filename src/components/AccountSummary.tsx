import { LoaderCircle, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AuthStatus } from '../api/auth'

type AccountSummaryProps = {
  authStatus: AuthStatus | null
  authAction: 'sign-in' | 'sign-out' | null
  onSignOut: () => void
}

export function AccountSummary({ authStatus, authAction, onSignOut }: AccountSummaryProps) {
  const picture = authStatus?.user?.picture
  const [avatarFailed, setAvatarFailed] = useState(false)
  useEffect(() => setAvatarFailed(false), [picture])

  if (!authStatus?.authenticated || !authStatus.user) return null

  return (
    <div className="account-summary">
      {picture && !avatarFailed ? (
        <img
          src={picture}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
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
  )
}
