import { describe, it, expect, vi } from 'vitest'
import { createExerciseUseCase } from '@/features/exercise/create-exercise'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

function makeRepo(overrides: Partial<ExerciseRepository> = {}): any {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    updateName: vi.fn(),
    delete: vi.fn(),
    findByOwner: vi.fn(),
    inAnyRoutine: vi.fn(),
    ...overrides,
  } as unknown as any
}

describe('createExerciseUseCase', () => {
  it('creates an exercise when name is valid', () => {
    const repo = makeRepo()
    const persistedExercise = { id: { value: 42 }, name: 'Squat', ownerId: { value: 1 } }
    repo.create.mockReturnValue(persistedExercise)

    const useCase = createExerciseUseCase(repo)
    const result = useCase.execute('Squat', 1)

    expect(result).toEqual(persistedExercise)
    expect(repo.create).toHaveBeenCalledWith({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
  })

  it('rejects empty names', () => {
    const repo = makeRepo()

    const useCase = createExerciseUseCase(repo)

    expect(() => useCase.execute('', 1)).toThrow('Exercise name cannot be empty')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only names', () => {
    const repo = makeRepo()

    const useCase = createExerciseUseCase(repo)

    expect(() => useCase.execute('   ', 1)).toThrow('Exercise name cannot be empty')
  })

  it('rejects names over 100 characters', () => {
    const repo = makeRepo()
    const longName = 'a'.repeat(101)

    const useCase = createExerciseUseCase(repo)

    expect(() => useCase.execute(longName, 1)).toThrow('Exercise name too long')
  })

  it('accepts names of exactly 100 characters', () => {
    const repo = makeRepo()
    const name100 = 'a'.repeat(100)
    const persistedExercise = { id: { value: 1 }, name: name100, ownerId: { value: 1 } }
    repo.create.mockReturnValue(persistedExercise)

    const useCase = createExerciseUseCase(repo)
    const result = useCase.execute(name100, 1)

    expect(result.name).toBe(name100)
  })

  it('propagates repo.create errors', () => {
    const repo = makeRepo()
    repo.create.mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    const useCase = createExerciseUseCase(repo)

    expect(() => useCase.execute('Squat', 1)).toThrow('Database connection lost')
  })

  it('trims the name before storage', () => {
    const repo = makeRepo()
    const persistedExercise = { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }
    repo.create.mockReturnValue(persistedExercise)

    const useCase = createExerciseUseCase(repo)
    const result = useCase.execute('  Squat  ', 1)

    expect(result.name).toBe('Squat')
    expect(repo.create).toHaveBeenCalledWith({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
  })
})
