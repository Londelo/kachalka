import { describe, it, expect } from 'vitest'
import type { RangeFilter } from '@/features/chart/chart-entity'

// Compile-time type check: if old values are assignable, tsc will error
function assertRangeFilter(_value: RangeFilter): void {}

describe('RangeFilter', () => {
  it('accepts 6M', () => {
    const sample: RangeFilter = '6M'
    expect(sample).toBe('6M')
  })

  it('accepts 1Y', () => {
    const sample: RangeFilter = '1Y'
    expect(sample).toBe('1Y')
  })

  it('accepts ALL', () => {
    const sample: RangeFilter = 'ALL'
    expect(sample).toBe('ALL')
  })

  it('rejects 1M', () => {
    // @ts-expect-error '1M' should not be assignable to RangeFilter
    assertRangeFilter('1M')
  })

  it('rejects 3M', () => {
    // @ts-expect-error '3M' should not be assignable to RangeFilter
    assertRangeFilter('3M')
  })
})
