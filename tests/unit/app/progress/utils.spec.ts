import { describe, it, expect } from 'vitest'
import { calcExerciseMetrics, countTotalSets } from '@/app/progress/utils'
import type { ExerciseMetrics } from '@/app/progress/utils'
import type { WorkoutSet } from '@/features/workout/types'

// Micro tier: these two functions are pure over plain arrays, so every case below is a
// hand-built array in and an exact number out. Nothing is mocked, no database, no React,
// no server action — a mock here would mean the wrong thing is being tested.
//
// The contract these numbers come from is the one authored in the workout domain:
// a line's volume is its effective set count × weight × reps, and a line with no usable
// count is one set. Every expectation below is derived from that rule, never from the
// implementation's output.
//
// Fractional count (`count: 2.5`) is deliberately unasserted. Whether it floors or
// refuses is the counted-set domain rule's unsettled decision; pinning a number here
// would hard-code a call this feature does not own. That case belongs to the domain spec.

const metricsFor = (sets: WorkoutSet[]): ExerciseMetrics =>
  calcExerciseMetrics([{ name: 'Bench Press', sets }])[0]

describe('calcExerciseMetrics', () => {
  describe('counted lines are credited in full', () => {
    it('credits a single counted line by its set count, not as one row', () => {
      expect(metricsFor([{ id: 's1', reps: 5, weight: 135, count: 3 }])).toEqual({
        name: 'Bench Press',
        totalSets: 3,
        totalReps: 15,
        totalVolume: 2025,
        maxWeight: 135,
      })
    })

    it('accumulates two counted lines', () => {
      expect(
        metricsFor([
          { id: 's1', reps: 5, weight: 135, count: 3 },
          { id: 's2', reps: 3, weight: 155, count: 2 },
        ]),
      ).toEqual({
        name: 'Bench Press',
        totalSets: 5,
        totalReps: 21,
        totalVolume: 2955,
        maxWeight: 155,
      })
    })

    it('credits a legacy line and a counted line in the same session', () => {
      expect(
        metricsFor([
          { id: 's1', reps: 5, weight: 135 },
          { id: 's2', reps: 3, weight: 155, count: 2 },
        ]),
      ).toEqual({
        name: 'Bench Press',
        totalSets: 3,
        totalReps: 11,
        totalVolume: 1605,
        maxWeight: 155,
      })
    })

    it('stays exact at a large count', () => {
      expect(metricsFor([{ id: 's1', reps: 12, weight: 100, count: 20 }])).toEqual({
        name: 'Bench Press',
        totalSets: 20,
        totalReps: 240,
        totalVolume: 24000,
        maxWeight: 100,
      })
    })
  })

  describe('the missing-count and zero-count read', () => {
    it('reads a line with no count as exactly one set', () => {
      expect(metricsFor([{ id: 's1', reps: 5, weight: 135 }])).toEqual({
        name: 'Bench Press',
        totalSets: 1,
        totalReps: 5,
        totalVolume: 675,
        maxWeight: 135,
      })
    })

    it('reads an explicit count of 1 identically to an absent count', () => {
      expect(metricsFor([{ id: 's1', reps: 5, weight: 135, count: 1 }])).toEqual(
        metricsFor([{ id: 's1', reps: 5, weight: 135 }]),
      )
    })

    it('reads a count of 0 as one set, never zero sets', () => {
      expect(metricsFor([{ id: 's1', reps: 5, weight: 135, count: 0 }])).toEqual({
        name: 'Bench Press',
        totalSets: 1,
        totalReps: 5,
        totalVolume: 675,
        maxWeight: 135,
      })
    })

    it('reproduces the pre-count figures exactly for legacy rows', () => {
      expect(
        metricsFor([
          { id: 's1', reps: 5, weight: 135 },
          { id: 's2', reps: 3, weight: 155 },
        ]),
      ).toEqual({
        name: 'Bench Press',
        totalSets: 2,
        totalReps: 8,
        totalVolume: 1140,
        maxWeight: 155,
      })
    })
  })

  describe('maxWeight is count-blind', () => {
    it('lets a single heavy line outrank many lighter ones', () => {
      expect(
        metricsFor([
          { id: 's1', reps: 1, weight: 225, count: 1 },
          { id: 's2', reps: 5, weight: 135, count: 10 },
        ]),
      ).toEqual({
        name: 'Bench Press',
        totalSets: 11,
        totalReps: 51,
        totalVolume: 6975,
        maxWeight: 225,
      })
    })

    it('returns zero volume and zero peak when every line is at weight zero', () => {
      expect(metricsFor([{ id: 's1', reps: 5, weight: 0, count: 3 }])).toEqual({
        name: 'Bench Press',
        totalSets: 3,
        totalReps: 15,
        totalVolume: 0,
        maxWeight: 0,
      })
    })

    it('keeps the peak when reps are zero', () => {
      expect(metricsFor([{ id: 's1', reps: 0, weight: 135, count: 3 }])).toEqual({
        name: 'Bench Press',
        totalSets: 3,
        totalReps: 0,
        totalVolume: 0,
        maxWeight: 135,
      })
    })
  })

  describe('empty input', () => {
    it('still returns an entry of zeros for an exercise with no lines', () => {
      expect(metricsFor([])).toEqual({
        name: 'Bench Press',
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
        maxWeight: 0,
      })
    })

    it('never yields -Infinity for an empty group', () => {
      expect(metricsFor([]).maxWeight).toBe(0)
      expect(metricsFor([]).maxWeight).not.toBe(-Infinity)
    })

    it('returns an empty array for no exercises', () => {
      expect(calcExerciseMetrics([])).toEqual([])
    })
  })

  describe('several exercises', () => {
    it('tallies each exercise independently and preserves input order', () => {
      const result = calcExerciseMetrics([
        { name: 'Squat', sets: [{ id: 'a', reps: 5, weight: 100, count: 2 }] },
        { name: 'Bench Press', sets: [{ id: 'b', reps: 5, weight: 135, count: 3 }] },
      ])

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        name: 'Squat',
        totalSets: 2,
        totalReps: 10,
        totalVolume: 1000,
        maxWeight: 100,
      })
      expect(result[1]).toEqual({
        name: 'Bench Press',
        totalSets: 3,
        totalReps: 15,
        totalVolume: 2025,
        maxWeight: 135,
      })
    })

    it('does not merge two groups that share a name', () => {
      const result = calcExerciseMetrics([
        { name: 'Squat', sets: [{ id: 'a', reps: 5, weight: 100, count: 2 }] },
        { name: 'Squat', sets: [{ id: 'b', reps: 1, weight: 200, count: 1 }] },
      ])

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Squat')
      expect(result[1].name).toBe('Squat')
      expect(result[0].totalVolume).toBe(1000)
      expect(result[1].totalVolume).toBe(200)
    })

    it('passes the name through untouched', () => {
      expect(
        calcExerciseMetrics([
          { name: '  Incline Press  ', sets: [{ id: 's1', reps: 5, weight: 135, count: 1 }] },
        ])[0].name,
      ).toBe('  Incline Press  ')
    })
  })

  describe('purity', () => {
    it('does not mutate its argument and returns fresh entries', () => {
      const input = [
        { name: 'Squat', sets: [{ id: 'a', reps: 5, weight: 100, count: 2 }] },
        { name: 'Bench Press', sets: [{ id: 'b', reps: 5, weight: 135 }] },
      ]
      const clone = JSON.parse(JSON.stringify(input))

      const result = calcExerciseMetrics(input)

      expect(input).toEqual(clone)
      expect(result[0]).not.toBe(input[0])
      expect(result[1]).not.toBe(input[1])
    })
  })

  describe('returned shape', () => {
    it('returns exactly the five metric fields, all numeric but the name', () => {
      const entry = metricsFor([{ id: 's1', reps: 5, weight: 135, count: 3 }])

      expect(Object.keys(entry).sort()).toEqual([
        'maxWeight',
        'name',
        'totalReps',
        'totalSets',
        'totalVolume',
      ])
      expect(typeof entry.name).toBe('string')
      expect(typeof entry.totalSets).toBe('number')
      expect(typeof entry.totalReps).toBe('number')
      expect(typeof entry.totalVolume).toBe('number')
      expect(typeof entry.maxWeight).toBe('number')
    })
  })
})

describe('countTotalSets', () => {
  describe('a single line', () => {
    it('counts a line carrying count 3 as three sets', () => {
      expect(countTotalSets([{ id: 's1', reps: 5, weight: 135, count: 3 }])).toBe(3)
    })

    it('counts a line with no count as one set', () => {
      expect(countTotalSets([{ id: 's1', reps: 5, weight: 135 }])).toBe(1)
    })

    it('counts a line with count 0 as one set', () => {
      expect(countTotalSets([{ id: 's1', reps: 5, weight: 135, count: 0 }])).toBe(1)
    })

    it('ignores weight and reps entirely', () => {
      expect(countTotalSets([{ id: 's1', reps: 0, weight: 0, count: 4 }])).toBe(4)
    })
  })

  describe('several lines', () => {
    it('sums counted lines', () => {
      expect(
        countTotalSets([
          { id: 's1', reps: 5, weight: 135, count: 3 },
          { id: 's2', reps: 3, weight: 155, count: 2 },
        ]),
      ).toBe(5)
    })

    it('sums legacy and counted lines together', () => {
      expect(
        countTotalSets([
          { id: 's1', reps: 5, weight: 135 },
          { id: 's2', reps: 3, weight: 155, count: 3 },
        ]),
      ).toBe(4)
    })

    it('sums many lines', () => {
      expect(
        countTotalSets(
          ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, reps: 5, weight: 100, count: 2 })),
        ),
      ).toBe(10)
    })
  })

  describe('empty input', () => {
    it('returns 0 for an empty array', () => {
      expect(countTotalSets([])).toBe(0)
    })
  })
})
