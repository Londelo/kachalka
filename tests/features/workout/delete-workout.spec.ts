import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteWorkoutUseCase } from '@/features/workout/delete-workout'
import type { WorkoutRepository } from '@/features/workout/workout-repository'

function makeRepo(overrides: Partial<WorkoutRepository> = {}): WorkoutRepository {
  return {
    findById: vi.fn(),
    create: vi.fn(),
    findByDateAndExercise: vi.fn(),
    findByDate: vi.fn(),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByDayOfWeek: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteWorkoutUseCase', () => {
  it('deletes a log when user is the owner', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({
      id: { value: 1 },
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    })

    const useCase = deleteWorkoutUseCase(repo)
    useCase.execute(1, 1)

    expect(repo.findById).toHaveBeenCalledWith(1)
    expect(repo.delete).toHaveBeenCalledWith(1)
  })

  it('throws if log not found', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue(undefined)

    const useCase = deleteWorkoutUseCase(repo)

    expect(() => useCase.execute(999, 1)).toThrow('Workout log not found')
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('throws if log not owned by user', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({
      id: { value: 1 },
      userId: 2,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [],
      createdAt: '',
      updatedAt: '',
    })

    const useCase = deleteWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 1)).toThrow('Only the owner can delete this workout log')
    expect(repo.delete).not.toHaveBeenCalled()
  })
})
