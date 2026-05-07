import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateWorkoutUseCase } from '@/features/workout/update-workout'
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

describe('updateWorkoutUseCase', () => {
  it('updates sets on an existing log', () => {
    const repo = makeRepo()
    const existingLog = {
      id: { value: 1 },
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    repo.findById.mockReturnValue(existingLog)
    const updatedLog = {
      ...existingLog,
      sets: [{ reps: 5, weight: 110, rpe: 8, rest: 60, note: '' }],
    }
    repo.update.mockReturnValue(updatedLog)

    const useCase = updateWorkoutUseCase(repo)
    const result = useCase.execute(1, 1, [{ reps: 5, weight: 110, rpe: 8, rest: 60, note: '' }])

    expect(result).toEqual(updatedLog)
    expect(repo.update).toHaveBeenCalledWith(1, [{ reps: 5, weight: 110, rpe: 8, rest: 60, note: '' }])
  })

  it('validates each set before updating', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue({
      id: { value: 1 },
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [],
      createdAt: '',
      updatedAt: '',
    })

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 1, [{ reps: 5, weight: 0, rpe: 7, rest: 60, note: '' }])).toThrow('Weight must be greater than 0')
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('throws if log not found', () => {
    const repo = makeRepo()
    repo.findById.mockReturnValue(undefined)

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(999, 1, [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }])).toThrow('Workout log not found')
    expect(repo.update).not.toHaveBeenCalled()
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

    const useCase = updateWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 1, [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }])).toThrow('Only the owner can update this workout log')
    expect(repo.update).not.toHaveBeenCalled()
  })
})
