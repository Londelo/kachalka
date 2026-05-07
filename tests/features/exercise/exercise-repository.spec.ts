import { describe, it, expect, vi } from 'vitest'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { Exercise } from '@/features/exercise/exercise-entity'

function makeRepo(): ExerciseRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    updateName: vi.fn(),
    delete: vi.fn(),
    findByOwner: vi.fn(),
    inAnyRoutine: vi.fn(),
  }
}

describe('ExerciseRepository interface', () => {
  it('has findById method', () => {
    const repo = makeRepo()
    expect(typeof repo.findById).toBe('function')
  })

  it('has findByName method', () => {
    const repo = makeRepo()
    expect(typeof repo.findByName).toBe('function')
  })

  it('has findAll method', () => {
    const repo = makeRepo()
    expect(typeof repo.findAll).toBe('function')
  })

  it('has create method', () => {
    const repo = makeRepo()
    expect(typeof repo.create).toBe('function')
  })

  it('has updateName method', () => {
    const repo = makeRepo()
    expect(typeof repo.updateName).toBe('function')
  })

  it('has delete method', () => {
    const repo = makeRepo()
    expect(typeof repo.delete).toBe('function')
  })

  it('has findByOwner method', () => {
    const repo = makeRepo()
    expect(typeof repo.findByOwner).toBe('function')
  })

  it('has inAnyRoutine method', () => {
    const repo = makeRepo()
    expect(typeof repo.inAnyRoutine).toBe('function')
  })

  it('findById returns Exercise or undefined', () => {
    const repo = makeRepo() as ExerciseRepository
    repo.findById.mockReturnValue({ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } } as Exercise)

    const result = repo.findById(1)
    expect(result).toBeDefined()
  })

  it('findByOwner returns array of Exercises', () => {
    const repo = makeRepo() as ExerciseRepository
    const exercises: Exercise[] = [{ id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }]
    repo.findByOwner.mockReturnValue(exercises)

    const result = repo.findByOwner(1)
    expect(result).toHaveLength(1)
  })

  it('findAll returns array of Exercises', () => {
    const repo = makeRepo() as ExerciseRepository
    repo.findAll.mockReturnValue([])

    const result = repo.findAll()
    expect(Array.isArray(result)).toBe(true)
  })

  it('create returns an Exercise', () => {
    const repo = makeRepo() as ExerciseRepository
    const exercise: Exercise = { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } }
    repo.create.mockReturnValue(exercise)

    const result = repo.create(exercise)
    expect(result).toEqual(exercise)
  })

  it('updateName returns updated Exercise', () => {
    const repo = makeRepo() as ExerciseRepository
    const updated: Exercise = { id: { value: 1 }, name: 'Deadlift', ownerId: { value: 1 } }
    repo.updateName.mockReturnValue(updated)

    const result = repo.updateName(1, 'Deadlift')
    expect(result).toEqual(updated)
  })

  it('delete returns void', () => {
    const repo = makeRepo() as ExerciseRepository
    repo.delete.mockReturnValue(undefined)

    repo.delete(1)
    expect(repo.delete).toHaveBeenCalledWith(1)
  })

  it('inAnyRoutine returns boolean', () => {
    const repo = makeRepo() as ExerciseRepository
    repo.inAnyRoutine.mockReturnValue(false)

    const result = repo.inAnyRoutine(1)
    expect(typeof result).toBe('boolean')
  })
})
