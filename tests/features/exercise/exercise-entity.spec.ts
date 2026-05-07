import { describe, it, expect } from 'vitest'
import { ExerciseId, createExercise } from '@/features/exercise/exercise-entity'

describe('ExerciseId', () => {
  describe('make', () => {
    it('creates an ExerciseId from a positive integer', () => {
      const id = ExerciseId.make(1)
      expect(id).toEqual({ value: 1 })
    })

    it('creates an ExerciseId from zero', () => {
      const id = ExerciseId.make(0)
      expect(id).toEqual({ value: 0 })
    })

    it('creates an ExerciseId from a large integer', () => {
      const id = ExerciseId.make(999999)
      expect(id).toEqual({ value: 999999 })
    })

    it('rejects negative numbers', () => {
      expect(() => ExerciseId.make(-1)).toThrow()
    })

    it('rejects negative numbers beyond -1', () => {
      expect(() => ExerciseId.make(-100)).toThrow()
    })

    it('rejects floats', () => {
      expect(() => ExerciseId.make(1.5)).toThrow()
    })

    it('rejects strings', () => {
      expect(() => ExerciseId.make('1' as unknown as number)).toThrow()
    })

    it('rejects null', () => {
      expect(() => ExerciseId.make(null as unknown as number)).toThrow()
    })

    it('rejects undefined', () => {
      expect(() => ExerciseId.make(undefined as unknown as number)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => ExerciseId.make(NaN)).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => ExerciseId.make(Infinity)).toThrow()
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

  it('trims leading whitespace from name', () => {
    const exercise = createExercise('  Push-up', 1)
    expect(exercise.name).toBe('Push-up')
  })

  it('trims trailing whitespace from name', () => {
    const exercise = createExercise('Pull-up  ', 1)
    expect(exercise.name).toBe('Pull-up')
  })

  it('trims both leading and trailing whitespace', () => {
    const exercise = createExercise('  Deadlift  ', 2)
    expect(exercise.name).toBe('Deadlift')
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
