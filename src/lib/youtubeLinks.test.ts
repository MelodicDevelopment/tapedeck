import { describe, expect, it } from 'vitest'
import type { Playlist, Track } from '../data/mockPlaylist'
import { classifyYouTubeLink, creatorPageUrl } from './youtubeLinks'

const onScreen = 'dQw4w9WgXcQ'

describe('classifyYouTubeLink', () => {
  it('plays a different video from the embedded player inline', () => {
    expect(classifyYouTubeLink('https://www.youtube.com/watch?v=abcdefghijk&feature=emb_rel_end', onScreen)).toEqual({
      kind: 'play-inline',
      videoId: 'abcdefghijk',
    })
    expect(classifyYouTubeLink('https://youtu.be/abcdefghijk', onScreen)).toEqual({
      kind: 'play-inline',
      videoId: 'abcdefghijk',
    })
  })

  it('opens the browser for the video already on screen', () => {
    const url = `https://www.youtube.com/watch?v=${onScreen}`
    expect(classifyYouTubeLink(url, onScreen)).toEqual({ kind: 'open-external', url })
  })

  it('opens the browser for "Watch on YouTube" affordances regardless of id', () => {
    for (const feature of ['emb_logo', 'emb_title', 'emb_imp_woyt']) {
      const url = `https://www.youtube.com/watch?v=abcdefghijk&feature=${feature}`
      expect(classifyYouTubeLink(url, onScreen)).toEqual({ kind: 'open-external', url })
    }
  })

  it('opens the browser for anything that is not a video link', () => {
    const url = 'https://www.youtube.com/@somechannel'
    expect(classifyYouTubeLink(url, onScreen)).toEqual({ kind: 'open-external', url })
  })
})

describe('creatorPageUrl', () => {
  const playlist: Playlist = {
    name: 'Mix',
    kind: 'YouTube playlist',
    description: '',
    thumbnail: '',
    sourceUrl: 'https://www.youtube.com/playlist?list=PL1',
    tracks: [],
  }
  const track: Track = { id: onScreen, title: 'Song', artist: 'Some Band', duration: 10 }

  it('prefers the recorded channel id', () => {
    expect(creatorPageUrl({ ...track, channelId: 'UC123' }, playlist)).toBe('https://www.youtube.com/channel/UC123')
  })

  it('falls back to the source when it is a channel page', () => {
    const channelSource = { ...playlist, kind: 'YouTube channel', sourceUrl: 'https://www.youtube.com/@someband' }
    expect(creatorPageUrl(track, channelSource)).toBe('https://www.youtube.com/@someband')
  })

  it('falls back to a YouTube search for the creator name', () => {
    expect(creatorPageUrl(track, playlist)).toBe('https://www.youtube.com/results?search_query=Some%20Band')
  })

  it('has nothing to link for unavailable tracks', () => {
    expect(creatorPageUrl({ ...track, unavailable: true }, playlist)).toBeNull()
  })
})
