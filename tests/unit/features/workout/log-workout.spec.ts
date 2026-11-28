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

  it('throws when the row disappears before the update lands', () => {
    const repo = makeRepo()
    repo.findByDateAndExercise.mockReturnValue({
      id: 1,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    })
    repo.update.mockReturnValue(undefined)

    const useCase = logWorkoutUseCase(repo)

    expect(() =>
      useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 110 }]),
    ).toThrow('Workout log not found')
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

    expect(() => useCase.execute(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: -10 }])).toThrow('Weight must be more than 0 — enter the weight you lifted, or remove the line.')
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

  describe('refusal order — guard, then raw validation, then fold', () => {
    // Every fixture below is a one-line card, so the position log-workout.ts:16
    // hands validateSet (index + 1) is always 1 — the prefix is part of the
    // message the lifter is told, so it is part of what these cases pin.
    // EMPTY_MSG is the empty-array guard’s own sentence, not a line’s: bare.
    const WEIGHT_MSG = 'Line 1: Weight must be more than 0 — enter the weight you lifted, or remove the line.'
    const REPS_MSG = 'Line 1: Reps must be at least 1 — enter how many reps you did, or remove the line.'
    const COUNT_MSG = 'Line 1: Set count must be at least 1 — enter how many sets you did, or leave it blank for one.'
    const EMPTY_MSG = 'Must log at least one set'

    function thrownMessage(run: () => unknown): string {
      try {
        run()
      } catch (error) {
        return (error as Error).message
      }
      throw new Error('Expected the use case to throw, but it returned normally.')
    }

    function untouchedRepo(repo: any) {
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    }

    it('stops at the empty guard before reaching the repository at all', () => {
      const repo = makeRepo()
      const useCase = logWorkoutUseCase(repo)

      expect(thrownMessage(() => useCase.execute(1, 5, '2025-01-01', []))).toBe(EMPTY_MSG)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('reports the count for an illegal count, never the empty-array message', () => {
      const repo = makeRepo()
      const useCase = logWorkoutUseCase(repo)

      const message = thrownMessage(() =>
        useCase.execute(1, 5, '2025-01-01', [{ id: 'a', reps: 5, weight: 100, count: -1 }]),
      )

      expect(message).toBe(COUNT_MSG)
      expect(message).not.toBe(EMPTY_MSG)
      untouchedRepo(repo)
    })

    it.each([
      { name: 'a zero count', line: { id: 'a', reps: 5, weight: 100, count: 0 }, message: COUNT_MSG },
      { name: 'a count that floors below one', line: { id: 'a', reps: 5, weight: 100, count: 0.5 }, message: COUNT_MSG },
      { name: 'negative reps', line: { id: 'a', reps: -1, weight: 100 }, message: REPS_MSG },
      { name: 'a zero weight', line: { id: 'a', reps: 5, weight: 0 }, message: WEIGHT_MSG },
      { name: 'a non-numeric weight', line: { id: 'a', reps: 5, weight: 'heavy' }, message: WEIGHT_MSG },
    ])('refuses $name with its own message and writes nothing', ({ line, message }) => {
      const repo = makeRepo()
      const useCase = logWorkoutUseCase(repo)

      expect(thrownMessage(() => useCase.execute(1, 5, '2025-01-01', [line] as unknown as WorkoutSet[]))).toBe(message)
      untouchedRepo(repo)
    })
  })

  describe('the fold, on the create path', () => {
    it.each([
      {
        name: 'sums the counts of two matching lines',
        input: [
          { id: 'a', reps: 5, weight: 100, count: 2 },
          { id: 'b', reps: 5, weight: 100, count: 3 },
        ],
        expected: [{ id: 'a', reps: 5, weight: 100, count: 5 }],
      },
      {
        name: 'counts a blank line as one, never zero',
        input: [
          { id: 'a', reps: 5, weight: 100 },
          { id: 'b', reps: 5, weight: 100 },
        ],
        expected: [{ id: 'a', reps: 5, weight: 100, count: 2 }],
      },
      {
        name: 'leaves different work unfolded',
        input: [
          { id: 'a', reps: 5, weight: 100 },
          { id: 'b', reps: 8, weight: 60 },
        ],
        expected: [
          { id: 'a', reps: 5, weight: 100, count: 1 },
          { id: 'b', reps: 8, weight: 60, count: 1 },
        ],
      },
      {
        name: 'keeps a legal count verbatim',
        input: [{ id: 'a', reps: 5, weight: 135, count: 3 }],
        expected: [{ id: 'a', reps: 5, weight: 135, count: 3 }],
      },
      {
        name: 'floors a fractional count',
        input: [{ id: 'a', reps: 5, weight: 100, count: 2.7 }],
        expected: [{ id: 'a', reps: 5, weight: 100, count: 2 }],
      },
    ])('hands the repository $name', ({ input, expected }) => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue(undefined)
      const useCase = logWorkoutUseCase(repo)

      useCase.execute(1, 5, '2025-01-01', input)

      expect(repo.create).toHaveBeenCalledTimes(1)
      expect(repo.create.mock.calls[0][0].sets).toEqual(expected)
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('hands the repository a new array, never the caller’s', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue(undefined)
      const input: WorkoutSet[] = [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 3 },
      ]
      const useCase = logWorkoutUseCase(repo)

      useCase.execute(1, 5, '2025-01-01', input)

      expect(repo.create.mock.calls[0][0].sets).not.toBe(input)
    })

    it('leaves the caller’s array untouched', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue(undefined)
      const input: WorkoutSet[] = [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 3 },
      ]
      const snapshot = JSON.parse(JSON.stringify(input))
      const useCase = logWorkoutUseCase(repo)

      useCase.execute(1, 5, '2025-01-01', input)

      expect(input).toEqual(snapshot)
    })

    it('still carries userId, exerciseId and date around the collapsed sets', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue(undefined)
      const useCase = logWorkoutUseCase(repo)

      useCase.execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 3 },
      ])

      expect(repo.create).toHaveBeenCalledWith({
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'a', reps: 5, weight: 100, count: 5 }],
      })
    })
  })

  describe('the fold, on the update path', () => {
    it('replaces the found log’s sets with the collapsed array', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue({
        id: 7,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'z', reps: 12, weight: 200, count: 4 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      })
      repo.update.mockReturnValue({
        id: 7,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'a', reps: 5, weight: 100, count: 5 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      })
      const useCase = logWorkoutUseCase(repo)

      useCase.execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 3 },
      ])

      expect(repo.update).toHaveBeenCalledTimes(1)
      expect(repo.update).toHaveBeenCalledWith(7, [{ id: 'a', reps: 5, weight: 100, count: 5 }])
      expect(repo.create).not.toHaveBeenCalled()
    })
  })
})
