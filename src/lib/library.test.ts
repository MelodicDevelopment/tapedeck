import { describe, expect, it } from 'vitest'
import type { Track } from '../data/mockPlaylist'
import {
  createMixtape,
  deleteMixtape,
  emptyLibrary,
  mergeLibrary,
  mixtapeToPlaylist,
  normalizeLibrary,
  recordPlaybackProgress,
  removeSource,
  reorderMixtapeTrack,
  toggleMixtapeTrack,
  touchLastPlayed,
  upsertSource,
} from './library'

const track = (id: string): Track => ({ id, title: `Title ${id}`, artist: 'Artist', duration: 200 })

const source = (url: string) => ({
  url,
  name: `Source ${url}`,
  kind: 'YouTube channel',
  thumbnail: '',
  tracks: [] as Track[],
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

describe('reorderMixtapeTrack', () => {
  it('moves a track forward and backward', () => {
    let library = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const id = library.mixtapes[0].id
    library = toggleMixtapeTrack(library, id, track('b'))
    library = toggleMixtapeTrack(library, id, track('c'))
    expect(library.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])

    library = reorderMixtapeTrack(library, id, 0, 2)
    expect(library.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['b', 'c', 'a'])

    library = reorderMixtapeTrack(library, id, 2, 0)
    expect(library.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op for the same index or an unknown mixtape', () => {
    let library = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const id = library.mixtapes[0].id
    library = toggleMixtapeTrack(library, id, track('b'))

    expect(reorderMixtapeTrack(library, id, 0, 0)).toEqual(library)
    expect(reorderMixtapeTrack(library, 'missing-id', 0, 1)).toEqual(library)
  })
})

describe('playback tracking', () => {
  it('records when a source or mixtape was last opened', () => {
    let library = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    library = touchLastPlayed(library, { type: 'source', url: 'https://youtube.com/@a' })
    expect(library.sources[0].lastPlayedAt).toBeTruthy()

    library = createMixtape(library, 'Mix', track('abc'))
    const id = library.mixtapes[0].id
    library = touchLastPlayed(library, { type: 'mixtape', id })
    expect(library.mixtapes[0].lastPlayedAt).toBeTruthy()
  })

  it('records resume position for a source or mixtape', () => {
    let library = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    library = recordPlaybackProgress(library, { type: 'source', url: 'https://youtube.com/@a' }, 'trackA', 42)
    expect(library.sources[0]).toMatchObject({ lastTrackId: 'trackA', lastPositionSecs: 42 })

    library = createMixtape(library, 'Mix', track('abc'))
    const id = library.mixtapes[0].id
    library = recordPlaybackProgress(library, { type: 'mixtape', id }, 'abc', 10)
    expect(library.mixtapes[0]).toMatchObject({ lastTrackId: 'abc', lastPositionSecs: 10 })
  })

  it('preserves resume state when a source is re-saved (e.g. a metadata refresh)', () => {
    let library = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    library = recordPlaybackProgress(library, { type: 'source', url: 'https://youtube.com/@a' }, 'trackA', 42)
    library = upsertSource(library, source('https://youtube.com/@a'))
    expect(library.sources[0]).toMatchObject({ lastTrackId: 'trackA', lastPositionSecs: 42 })
  })

  it('bumps a mixtape updatedAt when its tracks change', () => {
    let library = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const createdAt = library.mixtapes[0].updatedAt
    library = toggleMixtapeTrack(library, library.mixtapes[0].id, track('b'))
    expect(library.mixtapes[0].updatedAt >= createdAt).toBe(true)
  })
})

describe('mergeLibrary', () => {
  it('dedupes sources by URL, keeping the most recently saved', () => {
    const current = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    const incoming = {
      ...emptyLibrary(),
      sources: [{ ...current.sources[0], savedAt: '2030-01-01T00:00:00.000Z' }],
    }

    const merged = mergeLibrary(current, incoming)
    expect(merged.sources).toHaveLength(1)
    expect(merged.sources[0].savedAt).toBe('2030-01-01T00:00:00.000Z')
  })

  it('keeps the copy with the more recent lastPlayedAt even if its savedAt is older', () => {
    const current = {
      ...emptyLibrary(),
      sources: [{ ...source('https://youtube.com/@a'), savedAt: '2020-01-01T00:00:00.000Z', lastPlayedAt: '2030-06-01T00:00:00.000Z', lastPositionSecs: 99 }],
    }
    const incoming = {
      ...emptyLibrary(),
      sources: [{ ...source('https://youtube.com/@a'), savedAt: '2025-01-01T00:00:00.000Z' }],
    }

    const merged = mergeLibrary(current, incoming)
    expect(merged.sources[0].lastPositionSecs).toBe(99)
  })

  it('merges mixtapes by id without duplicating them on repeat import', () => {
    const current = createMixtape(emptyLibrary(), 'Mix A', track('a'))
    const incoming = createMixtape(emptyLibrary(), 'Mix B', track('b'))

    const merged = mergeLibrary(current, incoming)
    expect(merged.mixtapes.map((entry) => entry.name).sort()).toEqual(['Mix A', 'Mix B'])

    const mergedAgain = mergeLibrary(merged, incoming)
    expect(mergedAgain.mixtapes).toHaveLength(2)
  })

  it('keeps the more recently updated mixtape rather than always taking the incoming one', () => {
    const current = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const id = current.mixtapes[0].id
    const updated = toggleMixtapeTrack(current, id, track('b'))
    const staleIncoming = {
      ...emptyLibrary(),
      mixtapes: [{ ...current.mixtapes[0], updatedAt: '2000-01-01T00:00:00.000Z' }],
    }

    const merged = mergeLibrary(updated, staleIncoming)
    expect(merged.mixtapes[0].tracks.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('does not resurrect a deleted mixtape when the remote copy predates the deletion', () => {
    // Simulates a sync round-trip right after deleting: "incoming" is the
    // stale Drive snapshot from before the deletion was ever uploaded.
    const withMixtape = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const staleRemote = withMixtape
    const afterDelete = deleteMixtape(withMixtape, withMixtape.mixtapes[0].id)

    const merged = mergeLibrary(afterDelete, staleRemote)
    expect(merged.mixtapes).toEqual([])
  })

  it('does not resurrect a removed source when the remote copy predates the removal', () => {
    const withSource = upsertSource(emptyLibrary(), source('https://youtube.com/@a'))
    const staleRemote = withSource
    const afterRemove = removeSource(withSource, 'https://youtube.com/@a')

    const merged = mergeLibrary(afterRemove, staleRemote)
    expect(merged.sources).toEqual([])
  })

  it('lets a genuinely newer edit on another device undo an older deletion', () => {
    const withMixtape = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const id = withMixtape.mixtapes[0].id
    const deletedHere = deleteMixtape(withMixtape, id)

    // Another device edited the mixtape (bumping updatedAt) after this
    // device's deletion tombstone was recorded.
    const editedElsewhere = toggleMixtapeTrack(withMixtape, id, track('b'))
    const laterEdit = {
      ...editedElsewhere,
      mixtapes: [{ ...editedElsewhere.mixtapes[0], updatedAt: '2099-01-01T00:00:00.000Z' }],
    }

    const merged = mergeLibrary(deletedHere, laterEdit)
    expect(merged.mixtapes.map((entry) => entry.id)).toEqual([id])
  })

  it('propagates and dedupes tombstones from both sides', () => {
    const withMixtape = createMixtape(emptyLibrary(), 'Mix', track('a'))
    const id = withMixtape.mixtapes[0].id
    const deletedHere = deleteMixtape(withMixtape, id)
    const deletedThere = deleteMixtape(withMixtape, id)

    const merged = mergeLibrary(deletedHere, deletedThere)
    expect(merged.deletedMixtapeIds).toHaveLength(1)
    expect(merged.deletedMixtapeIds[0].id).toBe(id)
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

  it('falls back to default playback settings when missing or malformed', () => {
    expect(normalizeLibrary({}).playbackSettings).toEqual({ shuffle: false, repeatMode: 'off', volume: 70 })
    expect(
      normalizeLibrary({ playbackSettings: { shuffle: 'yes', repeatMode: 'loop', volume: 'loud' } }).playbackSettings,
    ).toEqual({ shuffle: false, repeatMode: 'off', volume: 70 })
  })

  it('keeps valid playback settings', () => {
    expect(
      normalizeLibrary({ playbackSettings: { shuffle: true, repeatMode: 'one', volume: 42 } }).playbackSettings,
    ).toEqual({ shuffle: true, repeatMode: 'one', volume: 42 })
  })

  it('clamps out-of-range volume', () => {
    expect(normalizeLibrary({ playbackSettings: { volume: -20 } }).playbackSettings.volume).toBe(0)
    expect(normalizeLibrary({ playbackSettings: { volume: 500 } }).playbackSettings.volume).toBe(100)
  })
})
