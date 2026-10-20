import {describe, expect, it} from 'vitest'
import {formatAddedOn} from '@/lib/format'

describe('formatAddedOn', () => {
  it.each([
    ['2025-05-16T16:08:00Z', 'Added on May 16, 2025 at 12:08 PM'],
    ['2026-03-27T21:43:00Z', 'Added on Mar 27, 2026 at 5:43 PM'],
    ['2024-10-23T17:15:00Z', 'Added on Oct 23, 2024 at 1:15 PM'],
    ['2026-01-15T05:00:00Z', 'Added on Jan 15, 2026 at 12:00 AM'],
  ])('%s -> %s', (iso, expected) => expect(formatAddedOn(iso)).toBe(expected))

  it('uses Eastern time across the day boundary', () => {
    expect(formatAddedOn('2026-07-01T02:30:00Z')).toBe('Added on Jun 30, 2026 at 10:30 PM')
  })
})
