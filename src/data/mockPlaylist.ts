export type Track = {
  id: string
  title: string
  artist: string
  duration: number
  unavailable?: boolean
}

export type Playlist = {
  name: string
  kind: string
  description: string
  thumbnail: string
  sourceUrl: string
  tracks: Track[]
}

export function thumbnailUrl(id: string, quality: 'default' | 'mqdefault' = 'mqdefault') {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
