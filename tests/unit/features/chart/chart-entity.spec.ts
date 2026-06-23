import { describe, it, expect } from 'vitest'
import type { ChartBarData, ChartDataPoint, ExerciseInfo } from '@/features/chart/chart-entity'

describe('ChartBarData', () => {
  it('accepts a sample object with required fields', () => {
    const sample: ChartBarData = { date: '2025-01-01', volume: 100, exercises: [] }
    expect(sample.date).toBe('2025-01-01')
    expect(sample.volume).toBe(100)
  })

  it('accepts a sample object with optional tooltipData', () => {
    const sample: ChartBarData = {
      date: '2025-01-01',
      volume: 200,
      tooltipData: { sets: [], totalVolume: 0 },
      exercises: [],
    }
    expect(sample.date).toBe('2025-01-01')
    expect(sample.volume).toBe(200)
    expect(sample.tooltipData).toEqual({ sets: [], totalVolume: 0 })
  })

  it('requires date to be a string', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50, exercises: [] }
    expect(sample.date).toBeTypeOf('string')
  })

  it('requires volume to be a number', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50, exercises: [] }
    expect(sample.volume).toBeTypeOf('number')
  })

  it('allows tooltipData to be omitted', () => {
    const sample: ChartBarData = { date: '2025-06-15', volume: 50, exercises: [] }
    expect('tooltipData' in sample).toBe(false)
  })

  it('has optional tooltipData property', () => {
    const withTooltip: ChartBarData = {
      date: '2025-01-01',
      volume: 100,
      tooltipData: { sets: [], totalVolume: 0 },
      exercises: [],
    }
    expect(withTooltip.tooltipData).toBeDefined()
    expect(withTooltip.tooltipData).toBeTypeOf('object')
  })

  it('works without tooltipData', () => {
    const sample: ChartBarData = { date: '2025-01-01', volume: 100, exercises: [] }
    expect('tooltipData' in sample).toBe(false)
  })

  it('accepts exercises field with name and sets', () => {
    const sample: ChartBarData = {
      date: '2025-01-01',
      volume: 100,
      exercises: [{ name: 'Pull Up', sets: [] }],
    }
    expect(sample.exercises).toBeTypeOf('object')
    expect(sample.exercises[0].name).toBeTypeOf('string')
    expect(sample.exercises[0].sets).toBeTypeOf('object')
  })
})

describe('ExerciseInfo', () => {
  it('has id as number and name as string', () => {
    const sample: ExerciseInfo = { id: 1, name: 'Pull Up' }
    expect(sample.id).toBeTypeOf('number')
    expect(sample.name).toBeTypeOf('string')
  })
})

describe('ChartDataPoint', () => {
  it('accepts exercises field with name and sets', () => {
    const sample: ChartDataPoint = {
      date: '2025-01-01',
      volume: 100,
      sets: [],
      exercises: [{ name: 'Pull Up', sets: [] }],
    }
    expect(sample.exercises).toBeTypeOf('object')
    expect(sample.exercises[0].name).toBeTypeOf('string')
    expect(sample.exercises[0].sets).toBeTypeOf('object')
  })
})
