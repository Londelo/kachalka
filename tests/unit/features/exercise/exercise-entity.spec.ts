import { describe, it, expect } from 'vitest'
import { ExerciseId, createExercise } from '@/features/exercise/exercise-entity'

describe('ExerciseId', () => {
  describe('make', () => {
    it('creates an ExerciseId from a non-negative integer', () => {
      expect(ExerciseId.make(0)).toEqual({ value: 0 })
      expect(ExerciseId.make(1)).toEqual({ value: 1 })
      expect(ExerciseId.make(999999)).toEqual({ value: 999999 })
    })

    it('rejects negative numbers, floats, NaN, Infinity, strings, null, and undefined', () => {
      expect(() => ExerciseId.make(-1)).toThrow()
      expect(() => ExerciseId.make(-100)).toThrow()
      expect(() => ExerciseId.make(1.5)).toThrow()
      expect(() => ExerciseId.make(NaN)).toThrow()
      expect(() => ExerciseId.make(Infinity)).toThrow()
      expect(() => ExerciseId.make('1' as unknown as number)).toThrow()
      expect(() => ExerciseId.make(null as unknown as number)).toThrow()
      expect(() => ExerciseId.make(undefined as unknown as number)).toThrow()
    })
  })
})

describe('createExercise', () => {
  it('creates an exercise with valid name and ownerId', () => {
    const exercise = createExercise('Squat', 1)
    expect(exercise).toEqual({
      id: { value: 0 },
      name: 'Squat',
      ownerId: { value: 1 },
    })
  })

  it('trims leading, trailing, and both whitespace from name', () => {
    expect(createExercise('  Push-up', 1).name).toBe('Push-up')
    expect(createExercise('Pull-up  ', 1).name).toBe('Pull-up')
    expect(createExercise('  Deadlift  ', 2).name).toBe('Deadlift')
  })

  it('rejects empty string', () => {
    expect(() => createExercise('', 1)).toThrow('Exercise name cannot be empty')
  })

  it('rejects whitespace-only string', () => {
    expect(() => createExercise('   ', 1)).toThrow('Exercise name cannot be empty')
  })

  it('rejects names longer than 100 characters', () => {
    const longName = 'a'.repeat(101)
    expect(() => createExercise(longName, 1)).toThrow('Exercise name too long')
  })

  it('accepts a name of exactly 100 characters', () => {
    const name100 = 'a'.repeat(100)
    const exercise = createExercise(name100, 1)
    expect(exercise.name).toBe(name100)
  })

  it('returns a placeholder id with value 0', () => {
    const exercise = createExercise('Squat', 1)
    expect(exercise.id.value).toBe(0)
  })

  it('preserves the correct ownerId', () => {
    const exercise = createExercise('Bench Press', 42)
    expect(exercise.ownerId).toEqual({ value: 42 })
  })

  it('uses ownerId 0', () => {
    const exercise = createExercise('Squat', 0)
    expect(exercise.ownerId).toEqual({ value: 0 })
  })
})
