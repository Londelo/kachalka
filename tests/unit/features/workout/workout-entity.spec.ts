import { describe, it, expect } from 'vitest'
import {
  validateSet,
  calculateVolume,
  getSetCount,
  WorkoutLog,
} from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

describe('validateSet', () => {
  it('passes for a valid set', () => {
    const validSet: WorkoutSet = { id: 's1', reps: 5, weight: 100 }
    expect(() => validateSet(validSet)).not.toThrow()
  })

  it('allows weight of 0', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: 0 }
    expect(() => validateSet(set)).not.toThrow()
  })

  it('throws when weight is negative', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: -10 }
    expect(() => validateSet(set)).toThrow('Weight must be non-negative')
  })

  it('throws when reps is 0', () => {
    const set: WorkoutSet = { id: 's1', reps: 0, weight: 100 }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })

  it('throws when reps is negative', () => {
    const set: WorkoutSet = { id: 's1', reps: -1, weight: 100 }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })
})

describe('calculateVolume', () => {
  it('returns 0 for an empty array', () => {
    expect(calculateVolume([])).toBe(0)
  })

  it('calculates volume for a single set', () => {
    expect(calculateVolume([{ reps: 5, weight: 100 }])).toBe(500)
  })

  it('calculates volume for multiple sets', () => {
    const sets = [
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
    ]
    expect(calculateVolume(sets)).toBe(1500)
  })

  it('handles varying reps and weights', () => {
    const sets = [
      { reps: 5, weight: 100 },
      { reps: 4, weight: 110 },
      { reps: 3, weight: 120 },
    ]
    expect(calculateVolume(sets)).toBe(500 + 440 + 360)
  })

  const countedCases: {
    label: string
    sets: { reps: number; weight: number; count?: number }[]
    expected: number
  }[] = [
    {
      label: 'a line carrying count 3 is the work multiplied by three',
      sets: [{ reps: 5, weight: 135, count: 3 }],
      expected: 2025,
    },
    {
      label: 'a line with no count is exactly what it always was',
      sets: [{ reps: 5, weight: 135 }],
      expected: 675,
    },
    {
      label: 'an explicit count of 1 is identical to an absent count',
      sets: [{ reps: 5, weight: 135, count: 1 }],
      expected: 675,
    },
    {
      label: 'one line counted once sits beside its twin counted three times',
      sets: [
        { reps: 5, weight: 100 },
        { reps: 5, weight: 100, count: 3 },
      ],
      expected: 2000,
    },
    {
      label: 'a fractional count floors before the multiply',
      sets: [{ reps: 10, weight: 50, count: 2.7 }],
      expected: 1000,
    },
    {
      label: 'each line floors on its own instead of the total flooring',
      sets: [
        { reps: 10, weight: 50, count: 2.5 },
        { reps: 10, weight: 50, count: 2.5 },
      ],
      expected: 2000,
    },
    {
      label: 'the same line at count 1 is the unmultiplied base',
      sets: [{ reps: 10, weight: 50, count: 1 }],
      expected: 500,
    },
    {
      label: 'large values stay exact with no float drift',
      sets: [{ reps: 100, weight: 1000, count: 10 }],
      expected: 1000000,
    },
    {
      label: 'zero reps is passed through, being validateSet problem not this one',
      sets: [{ reps: 0, weight: 100, count: 2 }],
      expected: 0,
    },
    {
      label: 'negative reps is passed through, being validateSet problem not this one',
      sets: [{ reps: -1, weight: 100 }],
      expected: -100,
    },
  ]

  it.each(countedCases)('totals $label', ({ sets, expected }) => {
    expect(calculateVolume(sets)).toBe(expected)
  })

  const refusedCounts: { label: string; count: unknown }[] = [
    { label: '0', count: 0 },
    { label: '-2', count: -2 },
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
  ]

  it.each(refusedCounts)('refuses a line whose count is $label', ({ count }) => {
    const total = () => calculateVolume([{ reps: 5, weight: 100, count: count as number }])

    expect(total).toThrow(new Error(REFUSAL_MESSAGE))
  })

  it('refuses the whole total when only a later line carries a bad count', () => {
    const total = () =>
      calculateVolume([
        { reps: 5, weight: 100 },
        { reps: 5, weight: 100, count: 0 },
      ])

    expect(total).toThrow(new Error(REFUSAL_MESSAGE))
  })

  it('refuses a bad count with the very message the shared rule throws', () => {
    const ruleMessage = messageThrownBy(() => getSetCount({ count: 0 }))

    expect(() => calculateVolume([{ reps: 5, weight: 100, count: 0 }])).toThrow(ruleMessage)
  })
})

function messageThrownBy(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }

  throw new Error('the shared rule was expected to throw and did not')
}

const REFUSAL_MESSAGE =
  'Set count must be at least 1 - enter how many sets you did, or leave it blank for one.'

describe('getSetCount', () => {
  const acceptedCases: { label: string; line: { count?: number }; expected: number }[] = [
    { label: 'the count is absent', line: {}, expected: 1 },
    { label: 'the count is undefined', line: { count: undefined }, expected: 1 },
    {
      label: 'the count is null',
      line: { count: null } as unknown as { count?: number },
      expected: 1,
    },
    { label: 'the count is the floor boundary 1', line: { count: 1 }, expected: 1 },
    { label: 'the count is 3', line: { count: 3 }, expected: 3 },
    { label: 'the count is a large integer 12', line: { count: 12 }, expected: 12 },
    { label: 'the count is 2.7', line: { count: 2.7 }, expected: 2 },
    { label: 'the count is exactly half, 2.5', line: { count: 2.5 }, expected: 2 },
    { label: 'the count is 1.5, just above the floor', line: { count: 1.5 }, expected: 1 },
  ]

  it.each(acceptedCases)('reads $expected when $label', ({ line, expected }) => {
    expect(getSetCount(line)).toBe(expected)
  })

  const refusedCases: { label: string; count: unknown }[] = [
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: '0', count: 0 },
    { label: '-1', count: -1 },
    { label: '-0.5, a legal HTML float that floors to 0', count: -0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
    { label: '-Infinity', count: -Infinity },
    { label: 'the non-numeric string "heavy"', count: 'heavy' },
    { label: 'the numeric string "3", which Math.floor would accept', count: '3' },
    { label: 'the boolean true, which Math.floor would read as 1', count: true },
  ]

  it.each(refusedCases)('refuses the count $label', ({ count }) => {
    const read = () => getSetCount({ count: count as number })

    expect(read).toThrow(REFUSAL_MESSAGE)
  })

  it.each(refusedCases)('tells the lifter what to do when the count is $label', ({ count }) => {
    const read = () => getSetCount({ count: count as number })

    expect(read).toThrow(/count/i)
    expect(read).toThrow(/enter how many sets you did/i)
    expect(read).toThrow(/leave it blank for one/i)
    expect(read).not.toThrow('Must log at least one set')
  })

  it('throws an Error instance, not a bare string', () => {
    expect(() => getSetCount({ count: 0 })).toThrowError(Error)
  })

  it('never stamps the default onto a line that carried no count', () => {
    const line: { count?: number } = {}

    expect(getSetCount(line)).toBe(1)
    expect(Object.keys(line)).not.toContain('count')
    expect(line).toEqual({})
  })

  it('never rewrites a fractional count onto the line it read', () => {
    const line = { count: 2.7 }

    expect(getSetCount(line)).toBe(2)
    expect(line).toEqual({ count: 2.7 })
  })

  it('reads a frozen line without a frozen-object error', () => {
    const line = Object.freeze({ count: 3 })

    expect(() => getSetCount(line)).not.toThrow()
    expect(getSetCount(line)).toBe(3)
  })

  it('reads a frozen line with no count without a frozen-object error', () => {
    const line = Object.freeze({}) as { count?: number }

    expect(() => getSetCount(line)).not.toThrow()
    expect(getSetCount(line)).toBe(1)
  })

  it('leaves the stored line untouched when the same line is read twice', () => {
    const line: WorkoutSet = { id: 's1', reps: 5, weight: 100, count: 4 }

    expect(getSetCount(line)).toBe(4)
    expect(getSetCount(line)).toBe(4)
    expect(line).toEqual({ id: 's1', reps: 5, weight: 100, count: 4 })
  })
})

describe('WorkoutLog type structure', () => {
  it('has the expected shape', () => {
    const log: WorkoutLog = {
      id: 1,
      userId: 1,
      exerciseId: 2,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    expect(log.id).toBe(1)
    expect(log.userId).toBe(1)
    expect(log.exerciseId).toBe(2)
    expect(log.date).toBe('2025-01-01')
    expect(log.sets).toHaveLength(1)
    expect(log.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(log.updatedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})
