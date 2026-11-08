import { describe, expect, it } from 'vitest'
import { extractYouTubeVideoId, looksLikeUrl, validateYouTubeSource, videoWatchUrl } from './validation'

describe('validateYouTubeSource', () => {
  it('accepts channel handles and playlist URLs with or without a scheme', () => {
    expect(validateYouTubeSource('youtube.com/@lofihiphopmusic')).toBe('')
    expect(validateYouTubeSource('https://www.youtube.com/playlist?list=PL123')).toBe('')
    expect(validateYouTubeSource('https://music.youtube.com/playlist?list=PL123')).toBe('')
    expect(validateYouTubeSource('https://www.youtube.com/watch?v=abc&list=PL123')).toBe('')
  })

  it('requires a value', () => {
    expect(validateYouTubeSource('')).toBe('Paste a YouTube video, channel, or playlist URL first.')
  })

  it('accepts single-video URLs', () => {
    expect(validateYouTubeSource('https://www.youtube.com/watch?v=eblCSdq4rzU')).toBe('')
    expect(validateYouTubeSource('https://youtu.be/dQw4w9WgXcQ')).toBe('')
    expect(validateYouTubeSource('youtube.com/shorts/dQw4w9WgXcQ')).toBe('')
  })

  it('rejects non-YouTube URLs and malformed video ids', () => {
    expect(validateYouTubeSource('https://example.com/playlist')).toMatch(/doesn't look/)
    expect(validateYouTubeSource('https://youtu.be/nope')).toMatch(/doesn't look/)
    expect(validateYouTubeSource('https://www.youtube.com/watch?v=nope')).toMatch(/doesn't look/)
  })
})

describe('extractYouTubeVideoId', () => {
  it('reads the id from watch, short, shorts, and embed links', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('still yields the video for a watch link inside a playlist', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for channels, bare playlists, and junk', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/@channel')).toBeNull()
    expect(extractYouTubeVideoId('https://www.youtube.com/playlist?list=PL123')).toBeNull()
    expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(extractYouTubeVideoId('')).toBeNull()
  })

  it('builds a canonical watch URL', () => {
    expect(videoWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})

describe('looksLikeUrl', () => {
  it('treats links and domains as URLs', () => {
    expect(looksLikeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(looksLikeUrl('youtube.com/@lofihiphopmusic')).toBe(true)
    expect(looksLikeUrl('youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(looksLikeUrl('example.com/playlist')).toBe(true)
  })

  it('treats free text as a search query', () => {
    expect(looksLikeUrl('a sky full of stars cover')).toBe(false)
    expect(looksLikeUrl('coldplay')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
    expect(looksLikeUrl('what is youtube.com')).toBe(false)
  })
})
