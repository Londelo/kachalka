import { describe, it, expect } from 'vitest'
import { groupByGranularity } from '@/features/chart/chart-utils'
import type { ChartDataPoint, ChartBarData, TimeGranularity } from '@/features/chart/chart-entity'
import type { WorkoutSet } from '@/features/workout/types'
import { getSetCount } from '@/features/workout/workout-entity'

// A fixture's exercise tally is derived the way the door produces it (chart-repo-impl.ts:43,
// chart-utils.ts:68) — the sum of getSetCount over that exercise's own lines — never written
// as a literal a drifted fixture could leave honest.
const tally = (sets: WorkoutSet[]): number => sets.reduce((n, s) => n + getSetCount(s), 0)

describe('groupByGranularity — session', () => {
  it('groups session data as-is: single date, summed volume', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-01', volume: 50, sets: [{ id: 's2', reps: 5, weight: 40 }], exercises: [] },
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
      { date: '2025-01-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-02', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
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
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-08', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
      { date: '2025-01-12', volume: 50, sets: [{ id: 's3', reps: 5, weight: 40 }], exercises: [] },
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
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-13', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
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
      { date: '2025-01-05', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-15', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
      { date: '2025-01-25', volume: 50, sets: [{ id: 's3', reps: 5, weight: 40 }], exercises: [] },
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
      { date: '2025-01-20', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-02-10', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
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
      { date: '2025-03-01', volume: 45, sets: [{ id: 's1', reps: 5, weight: 90 }], exercises: [] },
      { date: '2025-03-01', volume: 64, sets: [{ id: 's2', reps: 8, weight: 80 }], exercises: [] },
      { date: '2025-03-01', volume: 80, sets: [{ id: 's3', reps: 10, weight: 80 }], exercises: [] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(189)
    expect(result[0].tooltipData?.totalVolume).toBe(189)
  })

  it('sums volume correctly within week group', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-01-06', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-09', volume: 150, sets: [{ id: 's2', reps: 12, weight: 50 }], exercises: [] },
      { date: '2025-01-11', volume: 75, sets: [{ id: 's3', reps: 5, weight: 30 }], exercises: [] },
    ]

    const result = groupByGranularity(input, 'week')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(325)
    expect(result[0].tooltipData?.totalVolume).toBe(325)
  })

  it('sums volume correctly within month group', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-06-01', volume: 200, sets: [{ id: 's1', reps: 10, weight: 100 }], exercises: [] },
      { date: '2025-06-15', volume: 300, sets: [{ id: 's2', reps: 12, weight: 100 }], exercises: [] },
      { date: '2025-06-28', volume: 150, sets: [{ id: 's3', reps: 8, weight: 75 }], exercises: [] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(650)
    expect(result[0].tooltipData?.totalVolume).toBe(650)
  })
})

describe('groupByGranularity — exercises merging', () => {
  it('merges exercises from multiple data points with concatenated sets', () => {
    const benchLine: WorkoutSet = { id: 's1', reps: 10, weight: 100 }
    const squatLine: WorkoutSet = { id: 's2', reps: 8, weight: 50 }
    const input: ChartDataPoint[] = [
      {
        date: '2025-01-01',
        volume: 300,
        sets: [benchLine],
        exercises: [{ name: 'Bench Press', sets: [benchLine], setCount: tally([benchLine]) }],
      },
      {
        date: '2025-01-01',
        volume: 200,
        sets: [squatLine],
        exercises: [{ name: 'Squat', sets: [squatLine], setCount: tally([squatLine]) }],
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
      { date: '2025-03-10', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-05', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
      { date: '2025-06-15', volume: 150, sets: [{ id: 's3', reps: 5, weight: 40 }], exercises: [] },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2025-01-05')
    expect(result[1].date).toBe('2025-03-10')
    expect(result[2].date).toBe('2025-06-15')
  })

  it('returns data sorted ascending by month key', () => {
    const input: ChartDataPoint[] = [
      { date: '2025-06-01', volume: 100, sets: [{ id: 's1', reps: 10, weight: 50 }], exercises: [] },
      { date: '2025-01-15', volume: 200, sets: [{ id: 's2', reps: 8, weight: 60 }], exercises: [] },
      { date: '2025-03-20', volume: 150, sets: [{ id: 's3', reps: 5, weight: 40 }], exercises: [] },
    ]

    const result = groupByGranularity(input, 'month')

    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2025-01-15')
    expect(result[1].date).toBe('2025-03-20')
    expect(result[2].date).toBe('2025-06-01')
  })
})

describe('setCount — counted sets', () => {
  const squatSession = (date: string, sets: WorkoutSet[], volume: number): ChartDataPoint => ({
    date,
    volume,
    sets,
    exercises: [{ name: 'Squat', sets: [...sets], setCount: tally(sets) }],
  })

  const oneCountedLine = { id: 'a', reps: 5, weight: 100, count: 2 } satisfies WorkoutSet
  const matchingLine = { id: 'b', reps: 5, weight: 100, count: 2 } satisfies WorkoutSet
  const uncountedLine = { id: 'a', reps: 5, weight: 100 } satisfies WorkoutSet
  const otherWork = { id: 'b', reps: 8, weight: 80 } satisfies WorkoutSet

  it('counts two lines of the same work by their counts, not by how many lines there are', () => {
    const result = groupByGranularity(
      [squatSession('2025-01-01', [oneCountedLine, matchingLine], 2000)],
      'session',
    )

    // The bar carries both lines, unfolded: the count is a sum over the lines,
    // not a rewrite of them. Two lines of identical work stay two lines.
    expect(result[0].tooltipData?.sets).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])
    expect(result[0].tooltipData?.setCount).toBe(4)
  })

  it('counts a line carrying no count as exactly one set, and never stamps that one onto the line it read', () => {
    const legacy: WorkoutSet = { id: 'a', reps: 5, weight: 100 }

    const result = groupByGranularity([squatSession('2025-01-01', [legacy], 500)], 'session')

    expect(result[0].tooltipData?.setCount).toBe(1)
    // The one set is counted, never written: neither the line it read nor the
    // copy it hands back grows a `count` the stored row never had.
    expect(result[0].tooltipData?.sets).toStrictEqual([{ id: 'a', reps: 5, weight: 100 }])
    expect(Object.keys(legacy)).toEqual(['id', 'reps', 'weight'])
  })

  it('counts two lines of different work as two sets and folds nothing', () => {
    const result = groupByGranularity(
      [squatSession('2025-01-01', [uncountedLine, otherWork], 1140)],
      'session',
    )

    expect(result[0].tooltipData?.sets).toHaveLength(2)
    expect(result[0].tooltipData?.setCount).toBe(2)
  })

  it('adds a counted line to an uncounted line of different work without merging them', () => {
    const result = groupByGranularity(
      [squatSession('2025-01-01', [{ ...oneCountedLine, count: 3 }, otherWork], 2140)],
      'session',
    )

    expect(result[0].tooltipData?.sets).toHaveLength(2)
    expect(result[0].tooltipData?.setCount).toBe(4)
  })

  it('floors each fractional line on its own before summing, so two halves of five make four and not five', () => {
    const result = groupByGranularity(
      [
        squatSession(
          '2025-01-01',
          [
            { id: 'a', reps: 5, weight: 100, count: 2.5 },
            { id: 'b', reps: 5, weight: 100, count: 2.5 },
          ],
          2000,
        ),
      ],
      'session',
    )

    // Each line is floored at the moment it is counted, not in the list it
    // came from: the bar still shows the two halves it was handed.
    expect(result[0].tooltipData?.sets).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 2.5 },
      { id: 'b', reps: 5, weight: 100, count: 2.5 },
    ])
    expect(result[0].tooltipData?.setCount).toBe(4)
  })

  it('reports zero sets for a session with no set lines at all', () => {
    const result = groupByGranularity(
      [
        {
          date: '2025-01-01',
          volume: 0,
          sets: [],
          exercises: [{ name: 'Squat', sets: [], setCount: tally([]) }],
        },
      ],
      'session',
    )

    expect(result[0].tooltipData?.sets).toEqual([])
    expect(result[0].tooltipData?.setCount).toBe(0)
    expect(result[0].volume).toBe(0)
    expect(result[0].exercises[0].setCount).toBe(0)
  })

  const emptyDataCases: { label: string; granularity: TimeGranularity }[] = [
    { label: 'session', granularity: 'session' },
    { label: 'week', granularity: 'week' },
    { label: 'month', granularity: 'month' },
  ]

  it.each(emptyDataCases)('returns no bars for empty data at $label granularity', ({ granularity }) => {
    expect(groupByGranularity([], granularity)).toEqual([])
  })

  it('sums the volumes it was handed rather than recomputing them from the sets', () => {
    const wrongSets: WorkoutSet[] = [{ id: 'a', reps: 1, weight: 1 }]
    const input: ChartDataPoint[] = [
      {
        date: '2025-01-01',
        volume: 2025,
        sets: wrongSets,
        exercises: [{ name: 'Squat', sets: wrongSets, setCount: tally(wrongSets) }],
      },
      {
        date: '2025-01-01',
        volume: 500,
        sets: [...wrongSets],
        exercises: [{ name: 'Squat', sets: [...wrongSets], setCount: tally(wrongSets) }],
      },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result).toHaveLength(1)
    expect(result[0].volume).toBe(2525)
    expect(result[0].tooltipData?.totalVolume).toBe(2525)
  })

  it('counts each exercise on its own merged lines within one data point', () => {
    const squatLine: WorkoutSet = { id: 'a', reps: 5, weight: 100, count: 3 }
    const benchCounted: WorkoutSet = { id: 'b', reps: 5, weight: 60, count: 2 }
    const benchUncounted: WorkoutSet = { id: 'c', reps: 5, weight: 60 }
    const benchLines = [benchCounted, benchUncounted]
    const input: ChartDataPoint[] = [
      {
        date: '2025-01-01',
        volume: 2400,
        sets: [squatLine, ...benchLines],
        exercises: [
          { name: 'Squat', sets: [squatLine], setCount: tally([squatLine]) },
          { name: 'Bench', sets: benchLines, setCount: tally(benchLines) },
        ],
      },
    ]

    const result = groupByGranularity(input, 'session')

    const squat = result[0].exercises.find((e) => e.name === 'Squat')
    const bench = result[0].exercises.find((e) => e.name === 'Bench')

    expect(squat?.setCount).toBe(3)
    expect(bench?.setCount).toBe(3)
    expect(bench?.sets).toStrictEqual([{ id: 'b', reps: 5, weight: 60, count: 3 }])
  })

  it('counts one exercise once per line when the same exercise arrives in two data points', () => {
    const countedLine: WorkoutSet = { id: 'a', reps: 5, weight: 100, count: 2 }
    const input: ChartDataPoint[] = [
      {
        date: '2025-01-01',
        volume: 1000,
        sets: [countedLine],
        exercises: [{ name: 'Squat', sets: [countedLine], setCount: tally([countedLine]) }],
      },
      {
        date: '2025-01-01',
        volume: 1000,
        sets: [{ ...countedLine }],
        exercises: [{ name: 'Squat', sets: [{ ...countedLine }], setCount: tally([{ ...countedLine }]) }],
      },
    ]

    const result = groupByGranularity(input, 'session')

    expect(result[0].exercises).toHaveLength(1)
    expect(result[0].exercises[0].name).toBe('Squat')
    expect(result[0].exercises[0].setCount).toBe(4)
    expect(result[0].exercises[0].sets).toHaveLength(1)
  })

  const granularityCases: {
    label: string
    granularity: TimeGranularity
    barCount: number
    setCounts: number[]
  }[] = [
    { label: 'session', granularity: 'session', barCount: 2, setCounts: [2, 2] },
    { label: 'week', granularity: 'week', barCount: 1, setCounts: [4] },
    { label: 'month', granularity: 'month', barCount: 1, setCounts: [4] },
  ]

  it.each(granularityCases)(
    'produces the same total set count when $label buckets two counted sessions of one week',
    ({ granularity, barCount, setCounts }) => {
      const input: ChartDataPoint[] = [
        squatSession('2025-01-06', [{ id: 'a', reps: 5, weight: 100, count: 2 }], 1000),
        squatSession('2025-01-08', [{ id: 'b', reps: 5, weight: 100, count: 2 }], 1000),
      ]

      const result = groupByGranularity(input, granularity)

      expect(result).toHaveLength(barCount)
      expect(result.map((bar) => bar.tooltipData?.setCount)).toEqual(setCounts)
      expect(result.flatMap((bar) => bar.exercises.map((ex) => ex.setCount))).toEqual(setCounts)
    },
  )

  it('keeps bars sorted by date while every bar still carries its own set count', () => {
    const input: ChartDataPoint[] = [
      squatSession('2025-03-10', [{ id: 'a', reps: 5, weight: 100, count: 3 }], 1500),
      squatSession('2025-01-05', [{ id: 'b', reps: 5, weight: 100 }], 500),
      squatSession(
        '2025-06-15',
        [
          { id: 'c', reps: 5, weight: 100, count: 2 },
          { id: 'd', reps: 8, weight: 80 },
        ],
        1640,
      ),
    ]

    const result = groupByGranularity(input, 'session')

    expect(result.map((bar) => bar.date)).toEqual(['2025-01-05', '2025-03-10', '2025-06-15'])
    expect(result.map((bar) => bar.tooltipData?.setCount)).toEqual([1, 3, 3])
  })

  it('hands back no array and no line that aliases the data it was given', () => {
    const topSets: WorkoutSet[] = [
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100 },
      { id: 'c', reps: 8, weight: 60 },
    ]
    const squatSets: WorkoutSet[] = [...topSets]
    const benchSets: WorkoutSet[] = [{ id: 'd', reps: 5, weight: 60, count: 2 }]
    const data: ChartDataPoint[] = [
      {
        date: '2025-01-06',
        volume: 2580,
        sets: topSets,
        exercises: [
          { name: 'Squat', sets: squatSets, setCount: tally(squatSets) },
          { name: 'Bench', sets: benchSets, setCount: tally(benchSets) },
        ],
      },
    ]
    const snapshot = JSON.parse(JSON.stringify(data))

    const result = groupByGranularity(data, 'week')

    expect(data).toEqual(snapshot)
    const inputArrays = [topSets, squatSets, benchSets]
    const returnedArrays = [
      result[0].tooltipData?.sets ?? [],
      ...result[0].exercises.map((ex) => ex.sets),
    ]
    for (const returned of returnedArrays) {
      for (const given of inputArrays) {
        expect(returned).not.toBe(given)
      }
      expect(returned.length).toBeGreaterThan(0)
      for (const line of returned) {
        expect(topSets.includes(line)).toBe(false)
      }
    }
  })
})

describe('groupByGranularity — one time group holding two exercises', () => {
  // A `week` or `month` group is built by `getVolumeByDate` with no exercise
  // filter (chart-repo-impl.ts:78), so the entries landing in one group are rows
  // for *different* exercises. `collapseSets` keys on `weight,reps` alone and
  // carries no exercise identity, so running that write-side fold over the lines
  // flattened across those entries merged a Squat line and a Bench line of
  // identical work into one line owned by whichever arrived first — while
  // `setCount` came out identical either way. Every other fixture in this file
  // built its sessions through `squatSession()`, which puts one exercise name on
  // every entry, so nothing here had ever put two exercises with matching
  // weight-and-reps into a single group.

  const countedLine = (id: string): WorkoutSet => ({ id, reps: 5, weight: 100, count: 1 })

  const sessionOf = (
    date: string,
    name: string,
    ids: string[],
    volume: number,
  ): ChartDataPoint => {
    const lines = ids.map((id) => countedLine(id))
    return { date, volume, sets: lines, exercises: [{ name, sets: [...lines], setCount: tally(lines) }] }
  }

  const crossExerciseCases: {
    label: string
    granularity: TimeGranularity
    squatDate: string
    benchDate: string
  }[] = [
    { label: 'week', granularity: 'week', squatDate: '2025-01-06', benchDate: '2025-01-08' },
    { label: 'month', granularity: 'month', squatDate: '2025-01-05', benchDate: '2025-01-15' },
  ]

  it.each(crossExerciseCases)(
    'keeps the lines of both exercises in one $label group instead of folding identical work into the first',
    ({ granularity, squatDate, benchDate }) => {
      const result = groupByGranularity(
        [
          sessionOf(squatDate, 'Squat', ['squat-a', 'squat-b'], 1000),
          sessionOf(benchDate, 'Bench', ['bench-a'], 500),
        ],
        granularity,
      )

      expect(result).toHaveLength(1)

      // The defect: all three lines are 100kg × 5, so the fold collapsed them to
      // a single `{ id: 'squat-a', count: 3 }` and the Bench work vanished from
      // the list `chart-repo-impl.ts:103` publishes as the bar's `sets`. Each
      // line keeps its own identity here — none of them owns another.
      expect(result[0].tooltipData?.sets).toStrictEqual([
        { id: 'squat-a', reps: 5, weight: 100, count: 1 },
        { id: 'squat-b', reps: 5, weight: 100, count: 1 },
        { id: 'bench-a', reps: 5, weight: 100, count: 1 },
      ])

      // The number the feature exists to produce is fold-invariant: these are
      // the very values the folded version produced, so dropping the fold moved
      // nothing the chart reads.
      expect(result[0].tooltipData?.setCount).toBe(3)
      expect(result[0].tooltipData?.totalVolume).toBe(1500)
      expect(result[0].volume).toBe(1500)

      // The per-exercise fold is the legitimate one and stays: there the lines
      // genuinely all belong to one named exercise, so Squat's two identical
      // lines still collapse into one line of count 2.
      expect(result[0].exercises).toStrictEqual([
        {
          name: 'Squat',
          sets: [{ id: 'squat-a', reps: 5, weight: 100, count: 2 }],
          setCount: 2,
        },
        {
          name: 'Bench',
          sets: [{ id: 'bench-a', reps: 5, weight: 100, count: 1 }],
          setCount: 1,
        },
      ])
    },
  )
})
