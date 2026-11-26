import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  createSqliteChartRepository,
  mapRowToDataPoint,
} from '@/features/chart/chart-repo-impl'
import type { ChartBarData, ChartDataPoint } from '@/features/chart/chart-entity'
import type { WorkoutSet } from '@/features/workout/types'

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

    const { createSqliteChartRepository } = await import('@/features/chart/chart-repo-impl')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb = {} as any
    const repo = createSqliteChartRepository(mockDb)

    const result = repo.getVolumeByDate(1, null, undefined, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].exercises).toEqual([
      { name: 'Bench Press', sets: [{ id: 's1', reps: 10, weight: 100 }] },
      { name: 'Squat', sets: [{ id: 's2', reps: 8, weight: 50 }] },
    ])
  })
})

const line = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's1',
  reps: 5,
  weight: 135,
  ...overrides,
})

const countedLine = line({ count: 3 })
const countedJson = JSON.stringify([countedLine])

function projectedRow(sets: unknown): Record<string, unknown> {
  return { date: '2025-01-01', sets, exerciseName: 'Squat' }
}

type QueryChain = { all: ReturnType<typeof vi.fn> }

function repoReturning(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = createSqliteChartRepository({} as any)
  const built = vi.mocked(drizzle).mock.results
  const chain = built[built.length - 1].value as unknown as QueryChain
  chain.all.mockReturnValue(rows)
  return repo
}

describe('volume — counted sets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mapRowToDataPoint — arrival shapes', () => {
    it.each([
      { name: 'a plain array', sets: [countedLine] },
      { name: 'raw JSON text', sets: countedJson },
      { name: 'a Drizzle wrapper around JSON text', sets: { value: countedJson } },
      { name: 'a Drizzle wrapper around an already-parsed array', sets: { value: [countedLine] } },
    ])('multiplies the count in for $name', ({ sets }) => {
      expect(mapRowToDataPoint(projectedRow(sets)).volume).toBe(2025)
    })
  })

  describe('mapRowToDataPoint — volume arithmetic', () => {
    it('keeps the pre-change number for a legacy line with no count key', () => {
      const result = mapRowToDataPoint(projectedRow([line()]))

      expect(result.volume).toBe(675)
      expect(result.sets[0].count).toBeUndefined()
      expect(Object.keys(result.sets[0])).not.toContain('count')
    })

    it('sums a counted line and a legacy line in the same session', () => {
      const result = mapRowToDataPoint(
        projectedRow([line({ weight: 100 }), line({ id: 's2', reps: 3, weight: 80, count: 2 })]),
      )

      expect(result.volume).toBe(980)
    })

    it('floors a fractional count before it multiplies', () => {
      const result = mapRowToDataPoint(projectedRow([line({ count: 2.7 })]))

      expect(result.volume).toBe(1350)
    })

    it('returns 0 for zero reps without validating the line', () => {
      expect(mapRowToDataPoint(projectedRow([line({ reps: 0, count: 3 })])).volume).toBe(0)
    })

    it('returns 0 for no sets', () => {
      expect(mapRowToDataPoint(projectedRow([])).volume).toBe(0)
    })
  })

  describe('mapRowToDataPoint — projections', () => {
    it('carries the count into both sets and exercises', () => {
      const result = mapRowToDataPoint(projectedRow([countedLine]))

      expect(result.sets[0].count).toBe(3)
      expect(result.exercises[0].sets[0].count).toBe(3)
    })

    it('leaves date and exercise name undisturbed by the count work', () => {
      const result = mapRowToDataPoint(projectedRow([countedLine]))

      expect(result.date).toBe('2025-01-01')
      expect(result.exercises[0].name).toBe('Squat')
    })
  })

  describe('getPeakVolume', () => {
    it.each([
      {
        name: 'a single counted session',
        rows: [{ sets: countedJson }],
        expected: 2025,
      },
      {
        name: 'the counted session over the larger-until-you-count legacy one',
        rows: [{ sets: JSON.stringify([line({ weight: 100 })]) }, { sets: countedJson }],
        expected: 2025,
      },
      {
        name: 'a legacy session with no count',
        rows: [{ sets: JSON.stringify([line()]) }],
        expected: 675,
      },
      { name: 'no rows at all', rows: [], expected: 0 },
      {
        name: 'rows whose sets are all empty',
        rows: [{ sets: '[]' }, { sets: '[]' }],
        expected: 0,
      },
    ])('returns $expected for $name', ({ rows, expected }) => {
      expect(repoReturning(rows).getPeakVolume(1, 1)).toBe(expected)
    })
  })

  describe('getIntensitySplit', () => {
    it('splits the count-aware volumes with percentages summing to 100', () => {
      const rows = [
        { date: '2025-01-01', sets: countedJson, exerciseName: 'Squat' },
        { date: '2025-01-02', sets: JSON.stringify([line({ weight: 100 })]), exerciseName: 'Squat' },
      ]

      const split = repoReturning(rows).getIntensitySplit(1, 1)

      const top = split.find((s) => s.type === 'TOP SET')
      const volumeSet = split.find((s) => s.type === 'VOLUME SET')

      expect(top).toBeDefined()
      expect(volumeSet).toBeDefined()
      expect((top?.percentage ?? 0) + (volumeSet?.percentage ?? 0)).toBe(100)
      expect((top?.percentage ?? 0)).toBeGreaterThan(volumeSet?.percentage ?? 0)
      expect(top?.percentage).toBe(80)
    })

    it('returns an empty split when there are no logs', () => {
      expect(repoReturning([]).getIntensitySplit(1, 1)).toEqual([])
    })
  })
})