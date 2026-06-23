import { describe, it, expect, vi } from 'vitest'
import { listExercisesUseCase } from '@/features/exercise/list-exercises'
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
