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

// The first iteration uses a curated catalogue while the YouTube Data API is
// intentionally unconfigured. Playback still happens in the official embed.
export const demoPlaylist: Playlist = {
  name: 'Sunday Desk Radio',
  kind: 'Demo YouTube playlist',
  description: 'A warm mix for unhurried afternoons',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  sourceUrl: 'https://www.youtube.com/playlist?list=tapedeck-demo',
  tracks: [
    {
      id: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      duration: 213,
    },
    {
      id: 'djV11Xbc914',
      title: 'Take On Me',
      artist: 'a-ha',
      duration: 243,
    },
    {
      id: '4NRXx6U8ABQ',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: 261,
    },
    {
      id: '5NV6Rdv1a3I',
      title: 'Get Lucky',
      artist: 'Daft Punk',
      duration: 248,
    },
    {
      id: 'HyHNuVaZJ-k',
      title: 'Feel Good Inc.',
      artist: 'Gorillaz',
      duration: 253,
    },
    {
      id: 'yKNxeF4KMsY',
      title: 'Yellow',
      artist: 'Coldplay',
      duration: 272,
    },
    {
      id: 'unavailable-demo',
      title: 'Soft Static (Archived Session)',
      artist: 'Unavailable on YouTube',
      duration: 209,
      unavailable: true,
    },
    {
      id: 'FTQbiNvZqaY',
      title: 'Africa',
      artist: 'TOTO',
      duration: 275,
    },
    {
      id: 'HgzGwKwLmgM',
      title: "Don't Stop Me Now",
      artist: 'Queen',
      duration: 210,
    },
  ],
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
