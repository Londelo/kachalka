import { describe, it, expect } from 'vitest'
import { validateSet, calculateVolume, WorkoutLog } from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

describe('validateSet', () => {
  it('passes for a valid set', () => {
    const validSet: WorkoutSet = { reps: 5, weight: 100, rpe: 7, rest: 60, note: 'good set' }
    expect(() => validateSet(validSet)).not.toThrow()
  })

  it('throws when weight is 0', () => {
    const set: WorkoutSet = { reps: 5, weight: 0, rpe: 7, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('Weight must be greater than 0')
  })

  it('throws when weight is negative', () => {
    const set: WorkoutSet = { reps: 5, weight: -10, rpe: 7, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('Weight must be greater than 0')
  })

  it('throws when reps is 0', () => {
    const set: WorkoutSet = { reps: 0, weight: 100, rpe: 7, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })

  it('throws when reps is negative', () => {
    const set: WorkoutSet = { reps: -1, weight: 100, rpe: 7, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })

  it('throws when rpe is 0', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 0, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('RPE must be between 1 and 10')
  })

  it('throws when rpe is less than 1', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: -1, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('RPE must be between 1 and 10')
  })

  it('throws when rpe is greater than 10', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 11, rest: 60, note: '' }
    expect(() => validateSet(set)).toThrow('RPE must be between 1 and 10')
  })

  it('passes when rpe is exactly 1', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 1, rest: 60, note: '' }
    expect(() => validateSet(set)).not.toThrow()
  })

  it('passes when rpe is exactly 10', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 10, rest: 60, note: '' }
    expect(() => validateSet(set)).not.toThrow()
  })

  it('throws when rest is negative', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 7, rest: -1, note: '' }
    expect(() => validateSet(set)).toThrow('Rest must be non-negative')
  })

  it('passes when rest is 0', () => {
    const set: WorkoutSet = { reps: 5, weight: 100, rpe: 7, rest: 0, note: '' }
    expect(() => validateSet(set)).not.toThrow()
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
      id: { value: 1 },
      userId: 1,
      exerciseId: 2,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    expect(log.id).toEqual({ value: 1 })
    expect(log.userId).toBe(1)
    expect(log.exerciseId).toBe(2)
    expect(log.date).toBe('2025-01-01')
    expect(log.sets).toHaveLength(1)
    expect(log.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(log.updatedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})
