import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
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

describe('logWorkoutUseCase', () => {
  it('creates a new log when none exists', () => {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue(undefined)
    const savedLog = {
      id: 1,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    repo.create.mockReturnValue(savedLog)

    const useCase = logWorkoutUseCase(repo)
    const result = useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])

    expect(result).toEqual(savedLog)
    expect(repo.findByDateAndExercise).toHaveBeenCalledWith(1, '2025-01-01', 5)
    expect(repo.create).toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('replaces sets when re-saving for the same exercise/date', () => {
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
    repo.findByDateAndExercise.mockReturnValue(existingLog)
    const updatedLog = {
      ...existingLog,
      sets: [{ id: 's1', reps: 5, weight: 110 }],
    }
    repo.update.mockReturnValue(updatedLog)

    const useCase = logWorkoutUseCase(repo)
    const result = useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 110 }])

    expect(result).toEqual(updatedLog)
    // Sets should be replaced, not appended — old sets should NOT be present
    expect(repo.update).toHaveBeenCalledWith(1, [{ id: 's1', reps: 5, weight: 110 }])
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('throws when sets array is empty', () => {
    const repo = makeRepo()
    const useCase = logWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 5, '2025-01-01', [])).toThrow('Must log at least one set')
    expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('throws when a set has invalid weight', () => {
    const repo = makeRepo()
    const useCase = logWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: -10 }])).toThrow('Weight must be non-negative')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('returns the saved log', () => {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue(undefined)
    const savedLog = {
      id: 42,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    repo.create.mockReturnValue(savedLog)

    const useCase = logWorkoutUseCase(repo)
    const result = useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])

    expect(result.id).toBe(42)
    expect(result).toBe(savedLog)
  })

  it('propagates repo.create errors', () => {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue(undefined)
    repo.create.mockImplementation(() => { throw new Error('Database connection lost') })

    const useCase = logWorkoutUseCase(repo)

    expect(() => useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])).toThrow('Database connection lost')
  })
})
