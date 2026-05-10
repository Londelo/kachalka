import { describe, it, expect } from 'vitest'
import type { TimeGranularity } from '@/features/chart/chart-entity'

// Compile-time type check: if invalid values are assignable, tsc will error
function assertTimeGranularity(_value: TimeGranularity): void {}

describe('TimeGranularity', () => {
  it('accepts session', () => {
    const sample: TimeGranularity = 'session'
    expect(sample).toBe('session')
  })

  it('accepts week', () => {
    const sample: TimeGranularity = 'week'
    expect(sample).toBe('week')
  })

  it('accepts month', () => {
    const sample: TimeGranularity = 'month'
    expect(sample).toBe('month')
  })

  it('rejects invalid string', () => {
    // @ts-expect-error 'invalid' should not be assignable to TimeGranularity
    assertTimeGranularity('invalid')
  })
})
