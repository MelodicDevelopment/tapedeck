export type RepeatMode = 'off' | 'all' | 'one'

/** Cycle order for the repeat button: off -> whole playlist -> one song. */
export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'
}

/** A play order with `lead` first and the remaining indices shuffled. */
export function shuffledOrder(count: number, lead: number): number[] {
  const rest: number[] = []
  for (let index = 0; index < count; index += 1) {
    if (index !== lead) rest.push(index)
  }
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return lead >= 0 && lead < count ? [lead, ...rest] : rest
}

export function sequentialOrder(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

/**
 * The next track index when stepping through `order` from `current`,
 * skipping unplayable tracks. Returns null when the edge of the order is
 * reached without `wrap`, or when nothing is playable.
 */
export function advanceIndex(
  order: number[],
  current: number,
  direction: 1 | -1,
  wrap: boolean,
  isPlayable: (index: number) => boolean,
): number | null {
  const count = order.length
  if (count === 0) return null
  const position = Math.max(0, order.indexOf(current))
  for (let step = 1; step <= count; step += 1) {
    const rawPosition = position + direction * step
    if (!wrap && (rawPosition < 0 || rawPosition >= count)) return null
    const index = order[((rawPosition % count) + count) % count]
    if (isPlayable(index)) return index
  }
  return null
}
