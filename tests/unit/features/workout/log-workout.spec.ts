import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutSet } from '@/features/workout/types'

function makeRepo(overrides?: Partial<WorkoutRepository>) {
  return {
    findById: vi.fn(),
    create: vi.fn(),
    findByDateAndExercise: vi.fn(),
    findByDate: vi.fn(),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByDayOfWeek: vi.fn(),
    findHistoryByDate: vi.fn(),
    ...overrides,
  } as unknown as any
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
    expect(repo.update).toHaveBeenCalledWith(1, [{ id: 's1', reps: 5, weight: 110, count: 1 }])
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

describe('logWorkoutUseCase — set count at the write boundary', () => {
  const savedLog = {
    id: 1,
    userId: 1,
    exerciseId: 5,
    date: '2025-01-01',
    sets: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }
  const existingLog = { ...savedLog, id: 7 }

  function createRepo() {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue(undefined)
    repo.create.mockReturnValue(savedLog)
    return repo
  }

  function updateRepo() {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue(existingLog)
    repo.update.mockReturnValue({ ...existingLog, sets: [] })
    return repo
  }

  describe('the create branch — what reaches repo.create', () => {
    it.each(
      [
        ['a line with no count key as one set', { id: 's1', reps: 5, weight: 135 }, 1],
        ['an explicit undefined count as one set', { id: 's1', reps: 5, weight: 135, count: undefined }, 1],
        ['a zero count as one set', { id: 's1', reps: 5, weight: 135, count: 0 }, 1],
        ['an empty-string count as one set', { id: 's1', reps: 5, weight: 135, count: '' }, 1],
        ['a count already at the floor unchanged', { id: 's1', reps: 5, weight: 135, count: 1 }, 1],
        ['a count of 3 unchanged', { id: 's1', reps: 5, weight: 135, count: 3 }, 3],
      ] as [string, unknown, number][],
    )('hands repo.create %s', (_label, line, expectedCount) => {
      const repo = createRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [line as WorkoutSet])

      expect(repo.create).toHaveBeenCalledWith({
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: expectedCount }],
      })
    })
  })

  describe('the update branch — what reaches repo.update', () => {
    it.each(
      [
        ['a line with no count key as one set', { id: 's1', reps: 5, weight: 135 }, 1],
        ['a count of 4 unchanged', { id: 's1', reps: 5, weight: 135, count: 4 }, 4],
      ] as [string, unknown, number][],
    )('hands repo.update %s', (_label, line, expectedCount) => {
      const repo = updateRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [line as WorkoutSet])

      expect(repo.update).toHaveBeenCalledWith(7, [{ id: 's1', reps: 5, weight: 135, count: expectedCount }])
      expect(repo.create).not.toHaveBeenCalled()
    })
  })

  describe('one incoming line is one stored line', () => {
    it('stores every line of a mixed batch, in order, with its own count and id', () => {
      const repo = createRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 3 },
        { id: 'b', reps: 8, weight: 95 },
      ])

      expect(repo.create.mock.calls[0][0].sets).toEqual([
        { id: 'a', reps: 5, weight: 135, count: 3 },
        { id: 'b', reps: 8, weight: 95, count: 1 },
      ])
    })

    it('does not expand a count of 3 into three lines', () => {
      const repo = createRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 135, count: 3 }])

      expect(repo.create.mock.calls[0][0].sets).toHaveLength(1)
    })

    it('spreads an unrecognised key through untouched beside the added count', () => {
      const repo = createRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 'a', reps: 5, weight: 135, note: 'x' } as WorkoutSet])

      expect(repo.create.mock.calls[0][0].sets).toEqual([{ id: 'a', reps: 5, weight: 135, note: 'x', count: 1 }])
    })
  })

  describe('a rejected count writes nothing', () => {
    it.each(
      [
        ['a negative count', [{ id: 's1', reps: 5, weight: 135, count: -1 }]],
        ['a non-numeric count', [{ id: 's1', reps: 5, weight: 135, count: 'abc' }]],
        [
          'a bad second line in an otherwise valid batch',
          [
            { id: 'a', reps: 5, weight: 135, count: 2 },
            { id: 'b', reps: 8, weight: 95, count: -1 },
          ],
        ],
      ] as [string, unknown[]][],
    )('throws for %s before touching the repository', (_label, sets) => {
      const repo = makeRepo()

      expect(() => logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', sets as WorkoutSet[])).toThrow(
        /^Set count must be at least 1$/,
      )
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('reports the weight fault ahead of the count fault', () => {
      const repo = makeRepo()

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: -10, count: -1 }]),
      ).toThrow(/^Weight must be non-negative$/)
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })
  })
})
