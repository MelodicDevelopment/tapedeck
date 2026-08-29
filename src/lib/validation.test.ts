import { describe, expect, it } from 'vitest'
import { validateYouTubeSource } from './validation'

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
