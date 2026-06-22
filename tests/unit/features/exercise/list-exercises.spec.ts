import { describe, it, expect, vi } from 'vitest'
import { listExercisesUseCase } from '@/features/exercise/list-exercises'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

function makeRepo(overrides: Partial<ExerciseRepository> = {}): ExerciseRepository {
  return {
    findById: vi.fn() as any,
    findByName: vi.fn() as any,
    findAll: vi.fn() as any,
    create: vi.fn() as any,
    updateName: vi.fn() as any,
    delete: vi.fn() as any,
    findByOwner: vi.fn() as any,
    inAnyRoutine: vi.fn() as any,
    ...overrides,
  }
}

describe('listExercisesUseCase', () => {
  it('returns empty array when no exercises exist', () => {
    const repo = makeRepo()
    repo.findAll.mockReturnValue([])

    const useCase = listExercisesUseCase(repo)
    const result = useCase.execute()

    expect(result).toEqual([])
  })

  it('returns exercises from the repo', () => {
    const exercises = [
      { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } },
      { id: { value: 2 }, name: 'Bench Press', ownerId: { value: 1 } },
    ]
    const repo = makeRepo()
    repo.findAll.mockReturnValue(exercises)

    const useCase = listExercisesUseCase(repo)
    const result = useCase.execute()

    expect(result).toEqual(exercises)
    expect(repo.findAll).toHaveBeenCalledTimes(1)
  })
})
