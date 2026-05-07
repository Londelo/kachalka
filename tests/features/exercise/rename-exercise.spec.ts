import { describe, it, expect, vi } from 'vitest'
import { renameExerciseUseCase } from '@/features/exercise/rename-exercise'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

function makeRepo(overrides: Partial<ExerciseRepository> = {}): ExerciseRepository {
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
  }
}

describe('renameExerciseUseCase', () => {
  it('renames an exercise when user is the owner', () => {
    const repo = makeRepo()
    const existingExercise = { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }
    const updatedExercise = { id: { value: 1 }, name: 'Squat (new)', ownerId: { value: 1 } }
    repo.findById.mockReturnValue(existingExercise)
    repo.updateName.mockReturnValue(updatedExercise)

    const useCase = renameExerciseUseCase(repo)
    const result = useCase.execute(1, 'Squat (new)', 1)

    expect(result).toEqual(updatedExercise)
    expect(repo.findById).toHaveBeenCalledWith(1)
    expect(repo.updateName).toHaveBeenCalledWith(1, 'Squat (new)')
  })

  it('rejects rename when user is not the owner', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 2 } })

    const useCase = renameExerciseUseCase(repo)

    expect(() => useCase.execute(1, 'Squat (new)', 1)).toThrow('Only the owner can rename this exercise')
    expect(repo.updateName).not.toHaveBeenCalled()
  })

  it('rejects when exercise is not found', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue(undefined)

    const useCase = renameExerciseUseCase(repo)

    expect(() => useCase.execute(999, 'New Name', 1)).toThrow('Exercise not found')
    expect(repo.updateName).not.toHaveBeenCalled()
  })

  it('rejects empty new names', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } })

    const useCase = renameExerciseUseCase(repo)

    expect(() => useCase.execute(1, '', 1)).toThrow('Name cannot be empty')
    expect(repo.updateName).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only new names', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } })

    const useCase = renameExerciseUseCase(repo)

    expect(() => useCase.execute(1, '   ', 1)).toThrow('Name cannot be empty')
    expect(repo.updateName).not.toHaveBeenCalled()
  })

  it('rejects new names over 100 characters', () => {
    const repo = makeRepo()
    const longName = 'a'.repeat(101)
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } })

    const useCase = renameExerciseUseCase(repo)

    expect(() => useCase.execute(1, longName, 1)).toThrow('Name too long')
    expect(repo.updateName).not.toHaveBeenCalled()
  })

  it('accepts a new name of exactly 100 characters', () => {
    const repo = makeRepo()
    const name100 = 'a'.repeat(100)
    const existingExercise = { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }
    const updatedExercise = { id: { value: 1 }, name: name100, ownerId: { value: 1 } }
    repo.findById.mockReturnValue(existingExercise)
    repo.updateName.mockReturnValue(updatedExercise)

    const useCase = renameExerciseUseCase(repo)
    const result = useCase.execute(1, name100, 1)

    expect(result.name).toBe(name100)
  })

  it('trims the new name before saving', () => {
    const repo = makeRepo()
    const existingExercise = { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }
    const updatedExercise = { id: { value: 1 }, name: 'Deadlift', ownerId: { value: 1 } }
    repo.findById.mockReturnValue(existingExercise)
    repo.updateName.mockReturnValue(updatedExercise)

    const useCase = renameExerciseUseCase(repo)
    useCase.execute(1, '  Deadlift  ', 1)

    expect(repo.updateName).toHaveBeenCalledWith(1, 'Deadlift')
  })
})
