import { describe, it, expect, vi, beforeEach } from 'vitest'
import { removeExerciseUseCase } from './remove-exercise'
import type { RoutineRepository } from './routine-repository'

function makeRepo(overrides: Partial<RoutineRepository> = {}): RoutineRepository {
  return {
    exerciseExists: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByUserAndDay: vi.fn(),
    findAllByUser: vi.fn(),
    findAllByUserGroupedByDay: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('removeExerciseUseCase', () => {
  it('deletes an existing assignment', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(true)
    repo.delete.mockReturnValue(undefined)

    const useCase = removeExerciseUseCase(repo)
    const result = useCase.execute(42)

    expect(result).toBeUndefined()
    expect(repo.exists).toHaveBeenCalledWith(42)
    expect(repo.delete).toHaveBeenCalledWith(42)
  })

  it('rejects when assignment is not found', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(false)

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute(999)).toThrow('Routine assignment not found')
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('rejects negative assignmentId', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(false)

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute(-1)).toThrow('Routine assignment not found')
    expect(repo.exists).toHaveBeenCalledWith(-1)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('rejects zero assignmentId', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(false)

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute(0)).toThrow('Routine assignment not found')
    expect(repo.exists).toHaveBeenCalledWith(0)
  })

  it('rejects float assignmentId', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(false)

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute(1.5)).toThrow('Routine assignment not found')
    expect(repo.exists).toHaveBeenCalledWith(1.5)
  })

  it('rejects string assignmentId', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(false)

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute('42' as unknown as number)).toThrow('Routine assignment not found')
    expect(repo.exists).toHaveBeenCalledWith('42')
  })

  it('propagates repo.delete errors', () => {
    const repo = makeRepo()
    repo.exists.mockReturnValue(true)
    repo.delete.mockImplementation(() => {
      throw new Error('Database locked')
    })

    const useCase = removeExerciseUseCase(repo)

    expect(() => useCase.execute(42)).toThrow('Database locked')
  })
})
