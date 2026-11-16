import { describe, it, expect } from 'vitest'
import {
  validateSet,
  calculateVolume,
  normalizeSetCount,
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

describe('normalizeSetCount', () => {
  describe('the floor to one', () => {
    it.each(
      [
        ['an absent count', undefined],
        ['a null count', null],
        ['an empty-string count', ''],
        ['a zero count', 0],
        ['a negative-zero count', -0],
        ['a fraction below one', 0.5],
      ] as [string, unknown][],
    )('reads %s as 1', (_label, raw) => {
      expect(normalizeSetCount(raw)).toBe(1)
    })
  })

  describe('pass-through and the floor boundary', () => {
    it.each(
      [
        ['a whole number as 1', 1, 1],
        ['a whole number written with a decimal point as 1', 1.0, 1],
        ['a larger whole number as 3', 3, 3],
        ['a fraction above one as 2 — floored down, never rounded up', 2.7, 2],
        ['a numeric string as 3', '3', 3],
        ['a numeric string padded with whitespace as 4', ' 4 ', 4],
        ['a fractional numeric string as 3', '3.9', 3],
        ['a zero written as a string as 1', '0', 1],
      ] as [string, unknown, number][],
    )('reads %s', (_label, raw, expected) => {
      expect(normalizeSetCount(raw)).toBe(expected)
    })
  })

  describe('rejection — reported, never silently corrected', () => {
    it.each(
      [
        ['a negative count', -1],
        ['a negative fraction', -0.5],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['-Infinity', -Infinity],
        ["a non-numeric string ('abc')", 'abc'],
        ["a partly-numeric string ('1abc')", '1abc'],
        ['an object', {}],
        ['an array', []],
        ['a boolean', true],
      ] as [string, unknown][],
    )('throws for %s', (_label, raw) => {
      expect(() => normalizeSetCount(raw)).toThrow(/^Set count must be at least 1$/)
    })

    it('rejects -1 rather than clamping it up to the floor', () => {
      let returned: number | undefined = Number.NaN
      let thrown: unknown

      try {
        returned = normalizeSetCount(-1)
      } catch (error) {
        thrown = error
      }

      expect(returned).toBeNaN()
      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe('Set count must be at least 1')
    })
  })
})

describe('validateSet — set count', () => {
  it('accepts a pre-change line that carries no count key at all', () => {
    const legacyLine: WorkoutSet = { id: 's1', reps: 5, weight: 100 }
    expect(() => validateSet(legacyLine)).not.toThrow()
  })

  it.each(
    [
      ['an explicit undefined count', { id: 's1', reps: 5, weight: 100, count: undefined }],
      ['a zero count', { id: 's1', reps: 5, weight: 100, count: 0 }],
      ['an empty-string count', { id: 's1', reps: 5, weight: 100, count: '' }],
      ['a count of 3', { id: 's1', reps: 5, weight: 100, count: 3 }],
    ] as [string, unknown][],
  )('accepts a line with %s', (_label, set) => {
    expect(() => validateSet(set as WorkoutSet)).not.toThrow()
  })

  it.each(
    [
      ['a negative count', { id: 's1', reps: 5, weight: 100, count: -1 }],
      ['a non-numeric count', { id: 's1', reps: 5, weight: 100, count: 'abc' }],
    ] as [string, unknown][],
  )('rejects %s', (_label, set) => {
    expect(() => validateSet(set as WorkoutSet)).toThrow(/^Set count must be at least 1$/)
  })

  it('checks weight ahead of count', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: -10, count: -1 }
    expect(() => validateSet(set)).toThrow(/^Weight must be non-negative$/)
  })
})
