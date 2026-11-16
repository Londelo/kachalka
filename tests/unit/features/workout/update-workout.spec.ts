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

  // The finding-10 invariant: two writers must not disagree on one logical line.
  // The first assertion catches a divergence between the writers; the second
  // catches both writers drifting to the same wrong byte together.
  it('stores identical bytes for one logical line through logWorkout and through updateWorkout', () => {
    const logicalLine = { id: 's1', reps: 5, weight: 100, count: 2.7 }

    const viaUpdateRepo = ownedRepo()
    updateWorkoutUseCase(viaUpdateRepo).execute(1, 1, [{ ...logicalLine }])

    const viaLogRepo = makeRepo()
    viaLogRepo.findByDateAndExercise.mockReturnValue(undefined)
    viaLogRepo.create.mockReturnValue(storedLog)
    logWorkoutUseCase(viaLogRepo).execute(1, 5, '2025-01-01', [{ ...logicalLine }])

    const storedByUpdate = viaUpdateRepo.update.mock.calls[0][1]
    const storedByLog = viaLogRepo.create.mock.calls[0][0].sets

    expect(storedByUpdate).toEqual(storedByLog)
    expect(storedByUpdate).toEqual([{ id: 's1', reps: 5, weight: 100, count: 2 }])
  })
})
