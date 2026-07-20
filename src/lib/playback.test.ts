import { describe, expect, it } from 'vitest'
import { advanceIndex, nextRepeatMode, sequentialOrder, shuffledOrder } from './playback'

const always = () => true

describe('repeat mode cycle', () => {
  it('cycles off -> all -> one -> off', () => {
    expect(nextRepeatMode('off')).toBe('all')
    expect(nextRepeatMode('all')).toBe('one')
    expect(nextRepeatMode('one')).toBe('off')
  })
})

describe('shuffledOrder', () => {
  it('keeps the lead track first and covers every index exactly once', () => {
    const order = shuffledOrder(10, 4)
    expect(order[0]).toBe(4)
    expect([...order].sort((a, b) => a - b)).toEqual(sequentialOrder(10))
  })
})

describe('advanceIndex', () => {
  const order = sequentialOrder(4)

  it('steps forward and backward with wrapping', () => {
    expect(advanceIndex(order, 1, 1, true, always)).toBe(2)
    expect(advanceIndex(order, 3, 1, true, always)).toBe(0)
    expect(advanceIndex(order, 0, -1, true, always)).toBe(3)
  })

  it('stops at the edges without wrap', () => {
    expect(advanceIndex(order, 3, 1, false, always)).toBeNull()
    expect(advanceIndex(order, 0, -1, false, always)).toBeNull()
    expect(advanceIndex(order, 2, 1, false, always)).toBe(3)
  })

  it('skips unplayable tracks', () => {
    const playable = (index: number) => index !== 2
    expect(advanceIndex(order, 1, 1, true, playable)).toBe(3)
    expect(advanceIndex(order, 3, -1, false, playable)).toBe(1)
  })

  it('returns null when nothing is playable', () => {
    expect(advanceIndex(order, 0, 1, true, () => false)).toBeNull()
  })

  it('follows a custom (shuffled) order', () => {
    expect(advanceIndex([2, 0, 3, 1], 0, 1, true, always)).toBe(3)
    expect(advanceIndex([2, 0, 3, 1], 1, 1, false, always)).toBeNull()
  })
})
