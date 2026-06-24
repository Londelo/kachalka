import { describe, it, expect, vi } from 'vitest'
import { deleteExerciseUseCase } from '@/features/exercise/delete-exercise'
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

describe('deleteExerciseUseCase', () => {
  it('deletes an exercise when user is the owner and not in any routine', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } })
    repo.inAnyRoutine.mockReturnValue(false)

    const useCase = deleteExerciseUseCase(repo)
    useCase.execute(1, 1)

    expect(repo.findById).toHaveBeenCalledWith(1)
    expect(repo.inAnyRoutine).toHaveBeenCalledWith(1)
    expect(repo.delete).toHaveBeenCalledWith(1)
  })

  it('rejects delete when user is not the owner', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 2 } })

    const useCase = deleteExerciseUseCase(repo)

    expect(() => useCase.execute(1, 1)).toThrow('Only the owner can delete this exercise')
    expect(repo.delete).not.toHaveBeenCalled()
    expect(repo.inAnyRoutine).not.toHaveBeenCalled()
  })

  it('rejects when exercise is not found', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue(undefined)

    const useCase = deleteExerciseUseCase(repo)

    expect(() => useCase.execute(999, 1)).toThrow('Exercise not found')
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('rejects delete when exercise is in a routine', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } })
    repo.inAnyRoutine.mockReturnValue(true)

    const useCase = deleteExerciseUseCase(repo)

    expect(() => useCase.execute(1, 1)).toThrow('Cannot delete exercise that is part of a routine')
    expect(repo.delete).not.toHaveBeenCalled()
  })
})
