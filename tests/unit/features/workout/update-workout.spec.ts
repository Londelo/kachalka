import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateWorkoutUseCase } from '@/features/workout/update-workout'
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
    // The use case writes the canonical line the domain handed back, not the raw
    // bytes it was given — a line with no count is stored as one set.
    expect(repo.update).toHaveBeenCalledWith(1, [{ id: 's1', reps: 5, weight: 110, count: 1 }])
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

// Finding 11 (PR #20): this was the one write path with no count case at all, and
// the one writer that never normalized — it called repo.update(logId, sets) with
// whatever the caller handed it, so the same logical line stored 2.7 here and 2
// through logWorkout. These cases pin the boundary that was unverified, so a
// future edit that drops normalizeSetLines from update-workout.ts goes red here
// rather than silently re-opening finding 10.
describe('updateWorkoutUseCase — set count at the write boundary', () => {
  const storedLog = {
    id: 1,
    userId: 1,
    exerciseId: 5,
    date: '2025-01-01',
    sets: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }

  function ownedRepo() {
    const repo = makeRepo()
    repo.findById.mockReturnValue(storedLog)
    repo.update.mockReturnValue({ ...storedLog, sets: [] })
    return repo
  }

  // Red if update-workout.ts stops routing through normalizeSetLines (the writer
  // would hand repo.update the raw POSTed count), or if normalizeSetCount stops
  // flooring. An empty count key, an absent one and '' all reach the same
  // undefined/null/'' branch of the normalizer, so only one is tabulated here.
  describe('a count that is accepted — what reaches repo.update', () => {
    it.each(
      [
        ['a non-integer count floored to a whole number of sets', { id: 's1', reps: 5, weight: 100, count: 2.7 }, 2],
        ['a zero count floored up to the floor of one', { id: 's1', reps: 5, weight: 100, count: 0 }, 1],
        ['an explicit undefined count defaulted to one set', { id: 's1', reps: 5, weight: 100, count: undefined }, 1],
      ] as [string, unknown, number][],
    )('hands repo.update %s', (_label, line, expectedCount) => {
      const repo = ownedRepo()

      updateWorkoutUseCase(repo).execute(1, 1, [line as WorkoutSet])

      expect(repo.update).toHaveBeenCalledWith(1, [{ id: 's1', reps: 5, weight: 100, count: expectedCount }])
    })
  })

  // Red if the write-side normalizer clamps instead of rejecting (the commander
  // would be silently rewritten rather than told), or if update-workout.ts moves
  // repo.update ahead of the normalizeSetLines call and writes a bad count.
  describe('a count that is rejected — repo.update is never reached', () => {
    it.each(
      [
        ['a negative count', { id: 's1', reps: 5, weight: 100, count: -1 }],
        ['a junk non-numeric count', { id: 's1', reps: 5, weight: 100, count: 'abc' }],
      ] as [string, unknown][],
    )('throws for %s before touching repo.update', (_label, line) => {
      const repo = ownedRepo()

      expect(() => updateWorkoutUseCase(repo).execute(1, 1, [line as WorkoutSet])).toThrow(
        /^Set count must be at least 1$/,
      )
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  // The finding-10 invariant: the two writers to the `sets` column must not
  // disagree on one logical line. The fixture is therefore two lines the fold
  // fuses, and it has to be — over a one-element array collapseDuplicateSets
  // is the identity, so a single line leaves the two writers byte-identical no
  // matter which of them forgot the fold, and the assertion would be describing
  // the invariant instead of pinning it. A foldable array is the one input on
  // which the two writers can be told apart at all.
  //
  // Counts are legal ones (2 and 1, not a fraction): since 7fbbe8a a fractional
  // count is refused outright by normalizeSetCount, so a 2.7 fixture would prove
  // the throw, not the fold.
  const matchingLines = (): WorkoutSet[] => [
    { id: 's1', reps: 5, weight: 100, count: 2 },
    { id: 's2', reps: 5, weight: 100, count: 1 },
  ]

  // The canonical form of that array, written here rather than read back off the
  // fold: one line, the first line's id, the two counts summed.
  const fusedIntoOneLine = [{ id: 's1', reps: 5, weight: 100, count: 3 }]

  // Each writer is handed its own array of its own line objects. Handed one shared
  // array instead, a writer that mutated its input would bend the other writer's
  // input into agreement with it, and the comparison below would pass for the
  // wrong reason.
  function bytesStoredByEachWriter() {
    const viaUpdateRepo = ownedRepo()
    updateWorkoutUseCase(viaUpdateRepo).execute(1, 1, matchingLines())

    const viaLogRepo = makeRepo()
    viaLogRepo.findByDateAndExercise.mockReturnValue(undefined)
    viaLogRepo.create.mockReturnValue(storedLog)
    logWorkoutUseCase(viaLogRepo).execute(1, 5, '2025-01-01', matchingLines())

    return {
      viaUpdate: viaUpdateRepo.update.mock.calls[0][1],
      viaLog: viaLogRepo.create.mock.calls[0][0].sets,
    }
  }

  // Red if either writer stops routing through normalizeSetLines and hands the
  // repository its own idea of the canonical form — the defect this pair of cases
  // exists to keep shut. The two writers reach the fold through one shared call
  // today, so this is the assertion that fails when one of them walks around it.
  it('stores identical bytes for two matching lines through logWorkout and through updateWorkout', () => {
    const { viaUpdate, viaLog } = bytesStoredByEachWriter()

    expect(viaUpdate).toEqual(viaLog)
  })

  // Red if the fold is dropped from the shared normalizer, which moves both writers
  // to the same wrong bytes together and so is invisible to the comparison above:
  // two agreeing writers storing an unfolded row is exactly the state finding 10
  // describes, and this is the assertion that refuses it. Pins the surviving id and
  // the summed count, so a fold that keeps the last line's id goes red here too.
  it('fuses two matching lines into one before either writer reaches the repository', () => {
    const { viaUpdate, viaLog } = bytesStoredByEachWriter()

    expect(viaUpdate).toEqual(fusedIntoOneLine)
    expect(viaLog).toEqual(fusedIntoOneLine)
  })
})
