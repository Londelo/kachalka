import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserRoutineUseCase } from '@/features/routine/get-user-routine'
import type { RoutineRepository } from '@/features/routine/routine-repository'

function makeRepo(overrides: Partial<RoutineRepository> = {}) {
  return {
    exerciseExists: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByUserAndDay: vi.fn(),
    findByUserExerciseAndDay: vi.fn(),
    findAllByUser: vi.fn(),
    findAllByUserGroupedByDay: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getUserRoutineUseCase', () => {
  it('returns grouped assignments for a user', () => {
    const repo = makeRepo()
    const grouped = {
      Monday: [
        { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
      ],
      Wednesday: [
        { id: { value: 2 }, userId: 1, exerciseId: 6, dayOfWeek: 'Wednesday' },
      ],
    }
    repo.findAllByUserGroupedByDay.mockReturnValue(grouped)

    const useCase = getUserRoutineUseCase(repo)
    const result = useCase.execute(1)

    expect(result).toEqual(grouped)
    expect(repo.findAllByUserGroupedByDay).toHaveBeenCalledWith(1)
  })

  it('returns empty object when no assignments exist', () => {
    const repo = makeRepo()
    repo.findAllByUserGroupedByDay.mockReturnValue({})

    const useCase = getUserRoutineUseCase(repo)
    const result = useCase.execute(999)

    expect(result).toEqual({})
  })

  it('returns grouped assignments for multiple exercises on same day', () => {
    const repo = makeRepo()
    const grouped = {
      Monday: [
        { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
        { id: { value: 2 }, userId: 1, exerciseId: 7, dayOfWeek: 'Monday' },
      ],
    }
    repo.findAllByUserGroupedByDay.mockReturnValue(grouped)

    const useCase = getUserRoutineUseCase(repo)
    const result = useCase.execute(1)

    expect(result).toEqual(grouped)
    expect((result as Record<string, typeof grouped['Monday']>)['Monday']).toHaveLength(2)
  })

  it('returns grouped assignments across all days', () => {
    const repo = makeRepo()
    const grouped = {
      Monday: [{ id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' }],
      Tuesday: [{ id: { value: 2 }, userId: 1, exerciseId: 6, dayOfWeek: 'Tuesday' }],
      Wednesday: [{ id: { value: 3 }, userId: 1, exerciseId: 7, dayOfWeek: 'Wednesday' }],
      Thursday: [{ id: { value: 4 }, userId: 1, exerciseId: 8, dayOfWeek: 'Thursday' }],
      Friday: [{ id: { value: 5 }, userId: 1, exerciseId: 9, dayOfWeek: 'Friday' }],
      Saturday: [{ id: { value: 6 }, userId: 1, exerciseId: 10, dayOfWeek: 'Saturday' }],
      Sunday: [{ id: { value: 7 }, userId: 1, exerciseId: 11, dayOfWeek: 'Sunday' }],
    }
    repo.findAllByUserGroupedByDay.mockReturnValue(grouped)

    const useCase = getUserRoutineUseCase(repo)
    const result = useCase.execute(1)

    expect(result).toEqual(grouped)
    expect(Object.keys(result)).toHaveLength(7)
  })
})
