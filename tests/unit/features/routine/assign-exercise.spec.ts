import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assignExerciseUseCase } from '@/features/routine/assign-exercise'
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

describe('assignExerciseUseCase', () => {
  it('creates an assignment when exercise exists and no duplicate on that day', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(true)
    repo.findByUserExerciseAndDay.mockReturnValue(undefined)
    const persisted = { id: { value: 42 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' }
    repo.create.mockReturnValue(persisted)

    const useCase = assignExerciseUseCase(repo)
    const result = useCase.execute(1, 5, 'Monday')

    expect(result).toEqual(persisted)
    expect(repo.exerciseExists).toHaveBeenCalledWith(5)
    expect(repo.findByUserExerciseAndDay).toHaveBeenCalledWith(1, 5, 0)
    expect(repo.create).toHaveBeenCalled()
  })

  it('rejects when exercise does not exist', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(false)

    const useCase = assignExerciseUseCase(repo)

    expect(() => useCase.execute(1, 5, 'Monday')).toThrow('Exercise not found')
    expect(repo.findByUserExerciseAndDay).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects when the same exercise is already assigned to that day', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(true)
    repo.findByUserExerciseAndDay.mockReturnValue({ id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' })

    const useCase = assignExerciseUseCase(repo)

    expect(() => useCase.execute(1, 5, 'Monday')).toThrow('This exercise is already assigned to this day')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects negative userId (passes through to repo)', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(true)
    repo.findByUserExerciseAndDay.mockReturnValue(undefined)
    repo.create.mockImplementation(() => {
      throw new Error('Validation failed')
    })

    const useCase = assignExerciseUseCase(repo)

    expect(() => useCase.execute(-1, 5, 'Monday')).toThrow()
  })

  it('propagates repo.create errors', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(true)
    repo.findByUserExerciseAndDay.mockReturnValue(undefined)
    repo.create.mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    const useCase = assignExerciseUseCase(repo)

    expect(() => useCase.execute(1, 5, 'Monday')).toThrow('Database connection lost')
  })

  it('creates an assignment for Wednesday', () => {
    const repo = makeRepo()
    repo.exerciseExists.mockReturnValue(true)
    repo.findByUserExerciseAndDay.mockReturnValue(undefined)
    const persisted = { id: { value: 10 }, userId: 2, exerciseId: 3, dayOfWeek: 'Wednesday' }
    repo.create.mockReturnValue(persisted)

    const useCase = assignExerciseUseCase(repo)
    const result = useCase.execute(2, 3, 'Wednesday')

    expect(result).toEqual(persisted)
    expect(repo.findByUserExerciseAndDay).toHaveBeenCalledWith(2, 3, 2)
  })

  it('calls exerciseExists before findByUserExerciseAndDay check', () => {
    const repo = makeRepo()
    const callOrder: string[] = []
    repo.exerciseExists.mockImplementation(() => {
      callOrder.push('exerciseExists')
      return true
    })
    repo.findByUserExerciseAndDay.mockImplementation(() => {
      callOrder.push('findByUserExerciseAndDay')
      return undefined
    })

    const useCase = assignExerciseUseCase(repo)
    useCase.execute(1, 5, 'Monday')

    expect(callOrder).toEqual(['exerciseExists', 'findByUserExerciseAndDay'])
  })
})
