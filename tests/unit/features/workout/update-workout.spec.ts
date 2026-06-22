import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateWorkoutUseCase } from '@/features/workout/update-workout'
import type { WorkoutRepository } from '@/features/workout/workout-repository'

function makeRepo(overrides: Partial<WorkoutRepository> = {}): WorkoutRepository {
  return {
    findById: vi.fn() as any,
    create: vi.fn() as any,
    findByDateAndExercise: vi.fn() as any,
    findByDate: vi.fn() as any,
    findAllByUser: vi.fn() as any,
    update: vi.fn() as any,
    delete: vi.fn() as any,
    findByDayOfWeek: vi.fn() as any,
    findHistoryByDate: vi.fn() as any,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateWorkoutUseCase', () => {
  it('updates sets on an existing log', () => {
    const repo = makeRepo()
    const existingLog = {
      id: 1,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    repo.findById.mockReturnValue(existingLog)
    const updatedLog = {
      ...existingLog,
      sets: [{ id: 's1', reps: 5, weight: 110 }],
    }
    repo.update.mockReturnValue(updatedLog)

    const useCase = updateWorkoutUseCase(repo)
    const result = useCase.execute(1, 1, [{ id: 's1', reps: 5, weight: 110 }])

    expect(result).toEqual(updatedLog)
    expect(repo.update).toHaveBeenCalledWith(1, [{ id: 's1', reps: 5, weight: 110 }])
  })

  it('validates each set before updating', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({
      id: 1,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [],
      createdAt: '',
      updatedAt: '',
    })

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 1, [{ id: 's1', reps: 5, weight: -10 }])).toThrow('Weight must be non-negative')
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('throws if log not found', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue(undefined)

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(999, 1, [{ id: 's1', reps: 5, weight: 100 }])).toThrow('Workout log not found')
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('throws if log not owned by user', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({
      id: 1,
      userId: 2,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [],
      createdAt: '',
      updatedAt: '',
    })

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 1, [{ id: 's1', reps: 5, weight: 100 }])).toThrow('Only the owner can update this workout log')
    expect(repo.update).not.toHaveBeenCalled()
  })
})
