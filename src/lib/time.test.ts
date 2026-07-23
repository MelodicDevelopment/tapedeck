import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './time'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

describe('formatRelativeTime', () => {
  it('labels recent and distant timestamps', () => {
    expect(formatRelativeTime(daysAgo(0))).toBe('Played today')
    expect(formatRelativeTime(daysAgo(1))).toBe('Yesterday')
    expect(formatRelativeTime(daysAgo(3))).toBe('3 days ago')
    expect(formatRelativeTime(daysAgo(10))).toBe('Last week')
    expect(formatRelativeTime(daysAgo(21))).toBe('3 weeks ago')
    expect(formatRelativeTime(daysAgo(45))).toBe('Last month')
    expect(formatRelativeTime(daysAgo(90))).toBe('3 months ago')
    expect(formatRelativeTime(daysAgo(400))).toBe('Over a year ago')
  })

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })
})
