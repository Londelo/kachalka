import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapRowToDataPoint } from '@/features/chart/chart-repo-impl'
import type { ChartBarData, ChartDataPoint } from '@/features/chart/chart-entity'

vi.mock('@/features/chart/chart-utils', () => ({
  groupByGranularity: vi.fn(),
}))
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    all: vi.fn().mockReturnValue([]),
  })),
}))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { groupByGranularity } from '@/features/chart/chart-utils'

describe('mapRowToDataPoint', () => {
  it('constructs exercises from row and calculates volume', () => {
    const row: Record<string, unknown> = {
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 10, weight: 100 }],
      exerciseName: 'Bench Press',
    }

    const result = mapRowToDataPoint(row)

    expect(result.date).toBe('2025-01-01')
    expect(result.volume).toBe(1000)
    expect(result.exercises).toEqual([{ name: 'Bench Press', sets: [{ id: 's1', reps: 10, weight: 100 }] }])
  })
})

describe('getVolumeByDate — granularity mapping', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('propagates exercises from grouped bars to returned data points', async () => {
    const mockGroupedBars: ChartBarData[] = [
      {
        date: '2025-01-01',
        volume: 300,
        exercises: [
          { name: 'Bench Press', sets: [{ id: 's1', reps: 10, weight: 100 }] },
          { name: 'Squat', sets: [{ id: 's2', reps: 8, weight: 50 }] },
        ],
      },
    ]

    vi.mocked(groupByGranularity).mockReturnValue(mockGroupedBars)

    const { SqliteChartRepository } = await import('@/features/chart/chart-repo-impl')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb = {} as any
    const repo = new SqliteChartRepository(mockDb)

    const result = repo.getVolumeByDate(1, null, undefined, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].exercises).toEqual([
      { name: 'Bench Press', sets: [{ id: 's1', reps: 10, weight: 100 }] },
      { name: 'Squat', sets: [{ id: 's2', reps: 8, weight: 50 }] },
    ])
  })
})