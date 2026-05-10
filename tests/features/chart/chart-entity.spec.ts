import { describe, it, expect } from 'vitest'
import type { ChartBarData } from '@/features/chart/chart-entity'

describe('ChartBarData', () => {

  it('accepts a sample object with required fields', () => {
    const sample: ChartBarData = { date: '2025-01-01', volume: 100 }
    expect(sample.date).toBe('2025-01-01')
    expect(sample.volume).toBe(100)
  })

  it('accepts a sample object with optional tooltipData', () => {
    const sample: ChartBarData = {
      date: '2025-01-01',
      volume: 200,
      tooltipData: { sets: [], totalVolume: 0 },
    }
    expect(sample.date).toBe('2025-01-01')
    expect(sample.volume).toBe(200)
    expect(sample.tooltipData).toEqual({ sets: [], totalVolume: 0 })
  })

  it('requires date to be a string', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50 }
    expect(sample.date).toBeTypeOf('string')
  })

  it('requires volume to be a number', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50 }
    expect(sample.volume).toBeTypeOf('number')
  })

  it('allows tooltipData to be omitted', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50 }
    expect('tooltipData' in sample).toBe(false)
  })
})
