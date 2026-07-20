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
    expect(validateYouTubeSource('')).toBe('Paste a YouTube channel or playlist URL first.')
  })

  it('rejects non-YouTube and single-video URLs', () => {
    expect(validateYouTubeSource('https://example.com/playlist')).toMatch(/doesn't look/)
    expect(validateYouTubeSource('https://youtu.be/dQw4w9WgXcQ')).toMatch(/doesn't look/)
  })
})
