/**
 * Extracts a leading "Vol.NN —" style prefix from a video title into its own
 * badge, so channels that number every upload (e.g. "Vol.46 — Nu-Metal...")
 * stay distinguishable in the queue without repeating the number in-line.
 * Returns null for titles that don't match; harmless no-op otherwise.
 */
export function parseVolumeBadge(title: string): { badge: string; rest: string } | null {
  const match = title.match(/^\s*vol(?:ume)?\.?\s*(\d+)\s*[-–—:]\s*(.+)$/i)
  if (!match) return null
  return { badge: `Vol.${match[1]}`, rest: match[2].trim() }
}
