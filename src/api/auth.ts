import { invoke, isTauri } from '@tauri-apps/api/core'

export type GoogleUser = {
  name: string
  email: string
  picture?: string
}

export type AuthStatus = {
  configured: boolean
  authenticated: boolean
  user?: GoogleUser
}

type CommandError = {
  code?: string
  message?: string
}

export class DesktopCommandError extends Error {
  code: string

  constructor(message: string, code = 'DESKTOP_COMMAND_FAILED') {
    super(message)
    this.name = 'DesktopCommandError'
    this.code = code
  }
}

export function isDesktopApp() {
  const packagedDesktopOrigin = window.location.hostname === 'localhost' && window.location.port === '14321'
  return isTauri()
    || packagedDesktopOrigin
    || new URLSearchParams(window.location.search).get('desktop') === '1'
}

function normalizeCommandError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const commandError = error as CommandError
    return new DesktopCommandError(commandError.message ?? fallback, commandError.code)
  }
  if (typeof error === 'string' && error) return new DesktopCommandError(error)
  return new DesktopCommandError(fallback)
}

export async function getGoogleAuthStatus() {
  try {
    return await invoke<AuthStatus>('google_auth_status')
  } catch (error) {
    throw normalizeCommandError(error, 'Tapedeck could not check your Google sign-in.')
  }
}

export async function signInWithGoogle() {
  try {
    return await invoke<AuthStatus>('sign_in_with_google')
  } catch (error) {
    throw normalizeCommandError(error, 'Tapedeck could not complete Google sign-in.')
  }
}

export async function signOutGoogle() {
  try {
    return await invoke<AuthStatus>('sign_out_google')
  } catch (error) {
    throw normalizeCommandError(error, 'Tapedeck could not sign out of Google.')
  }
}
