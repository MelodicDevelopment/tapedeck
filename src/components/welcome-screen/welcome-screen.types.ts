import type { Mixtape, SavedSource } from '../../lib/library'

export type LibraryEntry =
  | { type: 'source'; key: string; data: SavedSource }
  | { type: 'mixtape'; key: string; data: Mixtape }
