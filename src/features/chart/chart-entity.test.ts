import { describe, it, expect } from 'vitest'
import type { ChartBarData, ChartDataPoint, ExerciseInfo } from '@/features/chart/chart-entity'

describe('ChartBarData', () => {
  it('has date property as string', () => {
    const sample: ChartBarData = { date: '2025-01-01', volume: 100, exercises: [] }
    expect(sample.date).toBeTypeOf('string')
  })

  it('has volume property as number', () => {
    const sample: ChartBarData = { date: '2025-01-01', volume: 100, exercises: [] }
    expect(sample.volume).toBeTypeOf('number')
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
})

function assertExerciseInfo(_v: ExerciseInfo) {}

describe('ExerciseInfo', () => {
  it('has id as number and name as string', () => {
    const sample: ExerciseInfo = { id: 1, name: 'Pull Up' }
    assertExerciseInfo(sample)
    expect(sample.id).toBeTypeOf('number')
    expect(sample.name).toBeTypeOf('string')
  })
})

function assertChartDataPoint(_v: ChartDataPoint) {}

function assertChartBarData(_v: ChartBarData) {}

describe('ChartDataPoint', () => {
  it('accepts exercises field with name and sets', () => {
    const sample: ChartDataPoint = {
      date: '2025-01-01',
      volume: 100,
      sets: [],
      exercises: [{ name: 'Pull Up', sets: [] }],
    }
    assertChartDataPoint(sample)
    expect(sample.exercises).toBeTypeOf('object')
    expect(sample.exercises[0].name).toBeTypeOf('string')
    expect(sample.exercises[0].sets).toBeTypeOf('object')
  })
})

describe('ChartBarData', () => {
  it('accepts exercises field with name and sets', () => {
    const sample: ChartBarData = {
      date: '2025-01-01',
      volume: 100,
      exercises: [{ name: 'Pull Up', sets: [] }],
    }
    assertChartBarData(sample)
    expect(sample.exercises).toBeTypeOf('object')
    expect(sample.exercises[0].name).toBeTypeOf('string')
    expect(sample.exercises[0].sets).toBeTypeOf('object')
  })
})
