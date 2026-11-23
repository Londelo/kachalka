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

  describe('folding before the write', () => {
    const storedLog = {
      id: 1,
      userId: 1,
      exerciseId: 5,
      date: '2025-01-01',
      sets: [],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    function createPathRepo() {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue(undefined)
      repo.create.mockReturnValue(storedLog)
      return repo
    }

    function writtenSets(repo: ReturnType<typeof makeRepo>) {
      return repo.create.mock.calls[0][0].sets
    }

    it('folds two identical lines into one line carrying the summed count', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 135, count: 3 },
      ])

      expect(repo.create).toHaveBeenCalledTimes(1)
      expect(repo.create.mock.calls[0][0]).toEqual({
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'a', reps: 5, weight: 135, count: 5 }],
      })
    })

    it('folds three identical lines into one line carrying all three counts', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 135, count: 1 },
        { id: 'c', reps: 5, weight: 135, count: 3 },
      ])

      expect(writtenSets(repo)).toEqual([{ id: 'a', reps: 5, weight: 135, count: 6 }])
    })

    it('keeps lines apart when the weight differs, each with its own count', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 140, count: 3 },
      ])

      expect(writtenSets(repo)).toEqual([
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 140, count: 3 },
      ])
    })

    it('keeps lines apart when the reps differ, each with its own count', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 6, weight: 135, count: 3 },
      ])

      expect(writtenSets(repo)).toEqual([
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 6, weight: 135, count: 3 },
      ])
    })

    it('folds duplicates that are not adjacent, keeping the first line id and position', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 8, weight: 95, count: 1 },
        { id: 'c', reps: 5, weight: 135, count: 4 },
      ])

      expect(writtenSets(repo)).toEqual([
        { id: 'a', reps: 5, weight: 135, count: 6 },
        { id: 'b', reps: 8, weight: 95, count: 1 },
      ])
    })

    it('folds two lines that both arrive with a zero count into two sets', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 0 },
        { id: 'b', reps: 5, weight: 135, count: 0 },
      ])

      expect(writtenSets(repo)).toEqual([{ id: 'a', reps: 5, weight: 135, count: 2 }])
    })

    it('writes a lone line rather than an empty array', () => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 'a', reps: 5, weight: 135, count: 4 }])

      expect(repo.create).toHaveBeenCalledTimes(1)
      expect(writtenSets(repo)).toEqual([{ id: 'a', reps: 5, weight: 135, count: 4 }])
    })

    it('hands repo.update the collapsed array and never calls repo.create', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue({ id: 7 })
      repo.update.mockReturnValue({ ...storedLog, id: 7 })

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 135, count: 3 },
      ])

      expect(repo.update).toHaveBeenCalledWith(7, [{ id: 'a', reps: 5, weight: 135, count: 5 }])
      expect(repo.create).not.toHaveBeenCalled()
    })

    // The floor rule lives in normalizeSetCount and the whole-number rule in
    // assertWholeSetCount, and only a finite non-integer ever reaches the second
    // one — every other unusable count is refused by the first. A POSTed body
    // reaches this boundary as JSON, so a string count is a real input, not a
    // type error: '3' is three sets and '0' is one.
    it.each(
      [
        ['a null count as one set', { id: 's1', reps: 5, weight: 135, count: null }, 1],
        ['a numeric string count unchanged', { id: 's1', reps: 5, weight: 135, count: '3' }, 3],
        ['a numeric string zero count as one set', { id: 's1', reps: 5, weight: 135, count: '0' }, 1],
      ] as [string, unknown, number][],
    )('normalises %s on the way to the repository', (_label, line, expectedCount) => {
      const repo = createPathRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [line as WorkoutSet])

      expect(writtenSets(repo)).toEqual([{ id: 's1', reps: 5, weight: 135, count: expectedCount }])
    })
  })

  describe('a rejected count never reaches the repository', () => {
    // `normalizeSetLines` runs before `assertWholeSetCount`, so the entity floor
    // rule refuses -1, NaN, Infinity and any non-numeric value first; only a
    // finite non-integer survives long enough to be refused as a fraction.
    it.each(
      [
        ['a fractional count', [{ id: 's1', reps: 5, weight: 135, count: 2.5 }], /^Set count must be a whole number of at least 1$/],
        ['a NaN count', [{ id: 's1', reps: 5, weight: 135, count: NaN }], /^Set count must be at least 1$/],
        ['an Infinity count', [{ id: 's1', reps: 5, weight: 135, count: Infinity }], /^Set count must be at least 1$/],
        ['a boolean count', [{ id: 's1', reps: 5, weight: 135, count: true }], /^Set count must be at least 1$/],
      ] as [string, unknown[], RegExp][],
    )('throws for %s before touching the repository', (_label, sets, message) => {
      const repo = makeRepo()

      expect(() => logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', sets as WorkoutSet[])).toThrow(message)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('refuses the whole batch when a duplicate line carries a count below the floor', () => {
      const repo = makeRepo()

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
          { id: 'a', reps: 5, weight: 135, count: 2 },
          { id: 'b', reps: 5, weight: 135, count: -1 },
        ]),
      ).toThrow(/^Set count must be at least 1$/)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('refuses two fractional counts the fold would have summed into a whole one', () => {
      const repo = makeRepo()

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
          { id: 'a', reps: 5, weight: 135, count: 2.5 },
          { id: 'b', reps: 5, weight: 135, count: 2.5 },
        ]),
      ).toThrow(/^Set count must be a whole number of at least 1$/)
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  describe('the rules that run before the fold', () => {
    it('refuses an empty array before any repository call at all', () => {
      const repo = makeRepo()

      expect(() => logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [])).toThrow(/^Must log at least one set$/)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('rejects an unusable weight on a line the fold would have merged away', () => {
      const repo = makeRepo()

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
          { id: 'a', reps: 5, weight: 135, count: 2 },
          { id: 'b', reps: 5, weight: -10, count: 3 },
        ]),
      ).toThrow(/^Weight must be non-negative$/)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('rejects an unusable reps on a line the fold would have merged away', () => {
      const repo = makeRepo()

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
          { id: 'a', reps: 5, weight: 135, count: 2 },
          { id: 'b', reps: 0, weight: 135, count: 3 },
        ]),
      ).toThrow(/^Reps must be at least 1$/)
      expect(repo.findByDateAndExercise).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  describe('what the repository hands back', () => {
    it('returns whatever repo.update hands back, including nothing', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue({ id: 7 })
      repo.update.mockReturnValue(undefined)

      const result = logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [
        { id: 'a', reps: 5, weight: 135, count: 2 },
        { id: 'b', reps: 5, weight: 135, count: 3 },
      ])

      expect(result).toBeUndefined()
      expect(repo.update).toHaveBeenCalledWith(7, [{ id: 'a', reps: 5, weight: 135, count: 5 }])
    })

    it('propagates a repo.update failure unchanged', () => {
      const repo = makeRepo()
      repo.findByDateAndExercise.mockReturnValue({ id: 7 })
      repo.update.mockImplementation(() => {
        throw new Error('Database connection lost')
      })

      expect(() =>
        logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 'a', reps: 5, weight: 135, count: 2 }]),
      ).toThrow('Database connection lost')
    })
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

    // Guards the projection in validateSet (workout-entity.ts), landed in 2059ade.
    // `sets` arrives from a 'use server' entry point, so a POSTed body may carry
    // keys nobody in this codebase invented. Red if validateSet regains a spread
    // (`{ ...set, count: normalizeSetCount(set.count) }`) instead of picking the
    // four known fields: the spread hands `note` verbatim into the sets column,
    // where it round-trips back out through every read path.
    it('drops an unrecognised POSTed key rather than storing it beside the count', () => {
      const repo = createRepo()

      logWorkoutUseCase(repo).execute(1, 5, '2025-01-01', [{ id: 'a', reps: 5, weight: 135, note: 'x' } as WorkoutSet])

      expect(repo.create.mock.calls[0][0].sets).toEqual([{ id: 'a', reps: 5, weight: 135, count: 1 }])
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
