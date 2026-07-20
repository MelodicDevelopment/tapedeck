import { describe, expect, it } from 'vitest'
import type { Track } from '../data/mockPlaylist'
import {
  createMixtape,
  deleteMixtape,
  emptyLibrary,
  mixtapeToPlaylist,
  normalizeLibrary,
  removeSource,
  toggleMixtapeTrack,
  upsertSource,
} from './library'

const track = (id: string): Track => ({ id, title: `Title ${id}`, artist: 'Artist', duration: 200 })

const source = (url: string) => ({
  url,
  name: `Source ${url}`,
  kind: 'YouTube channel',
  thumbnail: '',
})

describe('library sources', () => {
  it('saves new sources most recent first and deduplicates by URL', () => {
    let library = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    library = upsertSource(library, source('https://youtube.com/@b'))
    library = upsertSource(library, source('https://youtube.com/@a'))

    expect(library.sources.map((entry) => entry.url)).toEqual([
      'https://youtube.com/@a',
      'https://youtube.com/@b',
    ])
  })

  it('removes a saved source by URL', () => {
    const library = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    expect(removeSource(library, 'https://youtube.com/@a').sources).toEqual([])
  })

  it('caps the saved source list', () => {
    let library = emptyLibrary()
    for (let index = 0; index < 40; index += 1) {
      library = upsertSource(library, source(`https://youtube.com/@channel${index}`))
    }
    expect(library.sources).toHaveLength(30)
    expect(library.sources[0].url).toBe('https://youtube.com/@channel39')
  })
})

describe('mixtapes', () => {
  it('creates a mixtape seeded with the chosen track', () => {
    const library = createMixtape(emptyLibrary(), '  Late nights  ', track('abc'))
    expect(library.mixtapes).toHaveLength(1)
    expect(library.mixtapes[0].name).toBe('Late nights')
    expect(library.mixtapes[0].tracks).toEqual([track('abc')])
  })

  it('toggles a track in and out of a mixtape', () => {
    let library = createMixtape(emptyLibrary(), 'Mix', track('abc'))
    const id = library.mixtapes[0].id

    library = toggleMixtapeTrack(library, id, track('def'))
    expect(library.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['abc', 'def'])

    library = toggleMixtapeTrack(library, id, track('abc'))
    expect(library.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['def'])
  })

  it('deletes a mixtape', () => {
    const library = createMixtape(emptyLibrary(), 'Mix', track('abc'))
    expect(deleteMixtape(library, library.mixtapes[0].id).mixtapes).toEqual([])
  })

  it('converts a mixtape into a playable playlist', () => {
    const library = createMixtape(emptyLibrary(), 'Mix', track('abc'))
    const playlist = mixtapeToPlaylist(library.mixtapes[0])
    expect(playlist.kind).toBe('Mixtape')
    expect(playlist.name).toBe('Mix')
    expect(playlist.tracks).toEqual([track('abc')])
    expect(playlist.thumbnail).toContain('abc')
  })
})

describe('normalizeLibrary', () => {
  it('returns an empty library for junk input', () => {
    expect(normalizeLibrary(null)).toEqual(emptyLibrary())
    expect(normalizeLibrary('nope')).toEqual(emptyLibrary())
    expect(normalizeLibrary({ sources: 'bad', mixtapes: 12 })).toEqual(emptyLibrary())
  })

  it('keeps valid entries and drops malformed ones', () => {
    const normalized = normalizeLibrary({
      sources: [source('https://youtube.com/@ok'), { url: '' }, 42],
      mixtapes: [
        { id: 'm1', name: 'Mix', createdAt: 'x', tracks: [track('abc'), { bogus: true }] },
        { name: 'missing id', tracks: [] },
      ],
    })
    expect(normalized.sources.map((entry) => entry.url)).toEqual(['https://youtube.com/@ok'])
    expect(normalized.mixtapes).toHaveLength(1)
    expect(normalized.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['abc'])
  })
})
