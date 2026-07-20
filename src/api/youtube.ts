import { invoke } from '@tauri-apps/api/core'
import type { Playlist } from '../data/mockPlaylist'
import { isDesktopApp } from './auth'

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

type ErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

export class TapedeckApiError extends Error {
  code: string

  constructor(message: string, code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'TapedeckApiError'
    this.code = code
  }
}

export async function resolveYouTubeSource(url: string, signal?: AbortSignal): Promise<Playlist> {
  if (isDesktopApp()) {
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')
    try {
      const playlist = await invoke<Playlist>('resolve_youtube_source', { url })
      if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')
      if (!playlist.name || !Array.isArray(playlist.tracks) || playlist.tracks.length === 0) {
        throw new TapedeckApiError('YouTube returned an empty or invalid playlist.', 'INVALID_RESPONSE')
      }
      return playlist
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (error instanceof TapedeckApiError) throw error
      if (typeof error === 'object' && error !== null) {
        const commandError = error as { code?: string; message?: string }
        throw new TapedeckApiError(
          commandError.message ?? 'Tapedeck could not load that YouTube source.',
          commandError.code,
        )
      }
      throw new TapedeckApiError(
        typeof error === 'string' ? error : 'Tapedeck could not load that YouTube source.',
      )
    }
  }

  let response: Response
  try {
    response = await fetch(`${configuredApiBase}/api/youtube/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TapedeckApiError('Tapedeck could not reach its server. Check that the API server is running.', 'SERVER_UNREACHABLE')
  }

  const body = await response.json().catch(() => ({})) as Playlist & ErrorBody
  if (!response.ok) {
    throw new TapedeckApiError(body.error?.message ?? 'Tapedeck could not load that YouTube source.', body.error?.code)
  }
  if (!body.name || !Array.isArray(body.tracks) || body.tracks.length === 0) {
    throw new TapedeckApiError('The server returned an empty or invalid playlist.', 'INVALID_RESPONSE')
  }
  return body
}
