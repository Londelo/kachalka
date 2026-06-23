import { describe, it, expect } from 'vitest'
import { groupByGranularity } from '@/features/chart/chart-utils'
import type { ChartDataPoint, ChartBarData } from '@/features/chart/chart-entity'

describe('groupByGranularity — session', () => {
  it('groups session data as-is: single date, summed volume', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-01', volume: 50, sets: [{ id: 's2', reps: 5, weight: 40 }] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-01')
    expect(result[0].volume).toBe(150)
    expect(result[0].tooltipData?.sets).toHaveLength(2)
    expect(result[0].tooltipData?.totalVolume).toBe(150)
  })

  it('returns multiple entries for different dates', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-02', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2025-01-01')
    expect(result[0].volume).toBe(100)
    expect(result[1].date).toBe('2025-01-02')
    expect(result[1].volume).toBe(200)
  })

  it('returns empty array for empty input', () => {
    const result = groupByGranularity([], 'session')
    expect(result).toEqual([])
  })
})

describe('groupByGranularity — week', () => {
  it('groups dates in the same ISO week under YYYY-Www with summed volume', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-08', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
      { date: '2025-01-12', volume: 50, sets: [{ id: 's3', reps: 5, weight: 40 }] },
    ]

    const result = groupByGranularity(input, 'week')

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-06')
    expect(result[0].volume).toBe(350)
    expect(result[0].tooltipData?.sets).toHaveLength(3)
    expect(result[0].tooltipData?.totalVolume).toBe(350)
  })

  it('separates dates across different ISO weeks', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-13', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
    ]

    const result = groupByGranularity(input, 'week')

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2025-01-06')
    expect(result[0].volume).toBe(100)
    expect(result[1].date).toBe('2025-01-13')
    expect(result[1].volume).toBe(200)
  })
})

describe('groupByGranularity — month', () => {
  it('groups dates in the same calendar month under YYYY-MM with summed volume', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-05', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-15', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
      { date: '2025-01-25', volume: 50, sets: [{ id: 's3', reps: 5, weight: 40 }] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-05')
    expect(result[0].volume).toBe(350)
    expect(result[0].tooltipData?.sets).toHaveLength(3)
    expect(result[0].tooltipData?.totalVolume).toBe(350)
  })

  it('separates dates across different months', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-20', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-02-10', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2025-01-20')
    expect(result[0].volume).toBe(100)
    expect(result[1].date).toBe('2025-02-10')
    expect(result[1].volume).toBe(200)
  })
})

describe('groupByGranularity — volume summation', () => {
  it('sums volume correctly within session group', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-03-01', volume: 45, sets: [{ id: 's1', reps: 5, weight: 90 }] },
      { date: '2025-03-01', volume: 64, sets: [{ id: 's2', reps: 8, weight: 80 }] },
      { date: '2025-03-01', volume: 80, sets: [{ id: 's3', reps: 10, weight: 80 }] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(189)
    expect(result[0].tooltipData?.totalVolume).toBe(189)
  })

  it('sums volume correctly within week group', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-09', volume: 150, sets: [{ id: 's2', reps: 12, weight: 50 }] },
      { date: '2025-01-11', volume: 75, sets: [{ id: 's3', reps: 5, weight: 30 }] },
    ]

    const result = groupByGranularity(input, 'week')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(325)
    expect(result[0].tooltipData?.totalVolume).toBe(325)
  })

  it('sums volume correctly within month group', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-06-01', volume: 200, sets: [{ id: 's1', reps: 10, weight: 100 }] },
      { date: '2025-06-15', volume: 300, sets: [{ id: 's2', reps: 12, weight: 100 }] },
      { date: '2025-06-28', volume: 150, sets: [{ id: 's3', reps: 8, weight: 75 }] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(650)
    expect(result[0].tooltipData?.totalVolume).toBe(650)
  })
})

describe('groupByGranularity — exercises merging', () => {
  it('merges exercises from multiple data points with concatenated sets', () => {
    const input: ChartDataPoint[] = [
      {
        date: '2025-01-01',
        volume: 300,
        sets: [{ id: 's1', reps: 10, weight: 100 }],
        exercises: [{ name: 'Bench Press', sets: [{ id: 's1', reps: 10, weight: 100 }] }],
      },
      {
        date: '2025-01-01',
        volume: 200,
        sets: [{ id: 's2', reps: 8, weight: 50 }],
        exercises: [{ name: 'Squat', sets: [{ id: 's2', reps: 8, weight: 50 }] }],
      },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].exercises).toHaveLength(2)
    expect(result[0].exercises[0].name).toBe('Bench Press')
    expect(result[0].exercises[0].sets).toHaveLength(1)
    expect(result[0].exercises[1].name).toBe('Squat')
    expect(result[0].exercises[1].sets).toHaveLength(1)
  })
})

describe('groupByGranularity — sorted output', () => {
  it('returns data sorted ascending by date', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-03-10', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-05', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
      { date: '2025-06-15', volume: 150, sets: [{ id: 's3', reps: 5, weight: 40 }] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2025-01-05')
    expect(result[1].date).toBe('2025-03-10')
    expect(result[2].date).toBe('2025-06-15')
  })

  it('returns data sorted ascending by month key', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-06-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }] },
      { date: '2025-01-15', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }] },
      { date: '2025-03-20', volume: 150, sets: [{ id: 's3', reps: 5, weight: 40 }] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2025-01-15')
    expect(result[1].date).toBe('2025-03-20')
    expect(result[2].date).toBe('2025-06-01')
  })
})
