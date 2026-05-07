import { describe, it, expect } from 'vitest'
import { validateSet, calculateVolume, WorkoutLog } from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

describe('validateSet', () => {
  it('passes for a valid set', () => {
    const validSet: WorkoutSet = { reps: 5, weight: 100}
    expect(() => validateSet(validSet)).not.toThrow()
  })

  it('throws when weight is 0', () => {
    const set: WorkoutSet = { reps: 5, weight: 0}
    expect(() => validateSet(set)).toThrow('Weight must be greater than 0')
  })

  it('throws when weight is negative', () => {
    const set: WorkoutSet = { reps: 5, weight: -10}
    expect(() => validateSet(set)).toThrow('Weight must be greater than 0')
  })

  it('throws when reps is 0', () => {
    const set: WorkoutSet = { reps: 0, weight: 100}
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })

  it('throws when reps is negative', () => {
    const set: WorkoutSet = { reps: -1, weight: 100}
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
      id: { value: 1 },
      userId: 1,
      exerciseId: 2,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100}],
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
