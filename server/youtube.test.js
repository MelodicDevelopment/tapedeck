import { describe, expect, it, vi } from 'vitest'
import {
  parseIsoDuration,
  parseYouTubeSource,
  resolveYouTubeUrl,
  YouTubeResolverError,
} from './youtube.js'

describe('YouTube URL parsing', () => {
  it('recognizes playlists, handles, channel IDs, and usernames', () => {
    expect(parseYouTubeSource('youtube.com/watch?v=abc&list=PL123')).toMatchObject({ type: 'playlist', id: 'PL123' })
    expect(parseYouTubeSource('https://www.youtube.com/@GoogleDevelopers')).toMatchObject({ type: 'channel', filter: 'forHandle' })
    expect(parseYouTubeSource('https://youtube.com/channel/UC123')).toMatchObject({ type: 'channel', filter: 'id', id: 'UC123' })
    expect(parseYouTubeSource('https://youtube.com/user/legacy')).toMatchObject({ type: 'channel', filter: 'forUsername' })
  })

  it('rejects unrelated and single-video URLs', () => {
    expect(() => parseYouTubeSource('https://example.com/playlist')).toThrow(YouTubeResolverError)
    expect(() => parseYouTubeSource('https://youtu.be/dQw4w9WgXcQ')).toThrow(YouTubeResolverError)
  })
})

describe('YouTube response normalization', () => {
  it('parses ISO 8601 video durations', () => {
    expect(parseIsoDuration('PT4M38S')).toBe(278)
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('P1DT2H')).toBe(93600)
    expect(parseIsoDuration('invalid')).toBe(0)
  })

  it('resolves channel uploads and preserves unavailable playlist entries', async () => {
    const fetchImpl = vi.fn(async (request) => {
      const url = new URL(request)
      if (url.pathname.endsWith('/channels')) {
        return Response.json({ items: [{
          snippet: { title: 'Test channel', description: 'Channel description', thumbnails: { high: { url: 'channel.jpg' } } },
          contentDetails: { relatedPlaylists: { uploads: 'UU123' } },
        }] })
      }
      if (url.pathname.endsWith('/playlistItems')) {
        return Response.json({ items: [
          { snippet: { title: 'Public track', videoOwnerChannelTitle: 'Test channel' }, contentDetails: { videoId: 'video-1' } },
          { snippet: { title: 'Private track' }, contentDetails: { videoId: 'video-2' } },
        ] })
      }
      if (url.pathname.endsWith('/videos')) {
        return Response.json({ items: [{
          id: 'video-1',
          contentDetails: { duration: 'PT3M12S' },
          status: { embeddable: true, privacyStatus: 'public' },
        }] })
      }
      return new Response(null, { status: 404 })
    })

    const result = await resolveYouTubeUrl('https://youtube.com/@test', { apiKey: 'test-key', fetchImpl })
    expect(result.name).toBe('Test channel')
    expect(result.tracks).toEqual([
      { id: 'video-1', title: 'Public track', artist: 'Test channel', duration: 192, unavailable: false },
      { id: 'video-2', title: 'Private track', artist: 'Unavailable on YouTube', duration: 0, unavailable: true },
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('requires server-side API configuration', async () => {
    await expect(resolveYouTubeUrl('https://youtube.com/@test')).rejects.toMatchObject({
      code: 'API_NOT_CONFIGURED',
      status: 503,
    })
  })
})
