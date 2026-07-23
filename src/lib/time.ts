/** Compact relative-time label for library cards ("Played today", "2 days ago", "Last month"). */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diffMs = Date.now() - then
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays <= 0) return 'Played today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return 'Last week'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return 'Last month'
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return 'Over a year ago'
}
