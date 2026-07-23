import { describe, expect, it } from 'vitest'
import { parseVolumeBadge } from './trackTitle'

describe('parseVolumeBadge', () => {
  it('extracts common "Vol" prefix variants', () => {
    expect(parseVolumeBadge('Vol.46 — Nu-Metal · Aggressive Melodic · Trap & Bass')).toEqual({
      badge: 'Vol.46',
      rest: 'Nu-Metal · Aggressive Melodic · Trap & Bass',
    })
    expect(parseVolumeBadge('Vol 46 - Nu-Metal')).toEqual({ badge: 'Vol.46', rest: 'Nu-Metal' })
    expect(parseVolumeBadge('Volume 46: Nu-Metal')).toEqual({ badge: 'Vol.46', rest: 'Nu-Metal' })
    expect(parseVolumeBadge('vol.7 – Chill mix')).toEqual({ badge: 'Vol.7', rest: 'Chill mix' })
  })

  it('returns null for titles without the prefix', () => {
    expect(parseVolumeBadge('Never Gonna Give You Up')).toBeNull()
    expect(parseVolumeBadge('')).toBeNull()
  })
})
