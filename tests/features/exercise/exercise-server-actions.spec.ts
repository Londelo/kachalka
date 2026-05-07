import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDb = {}

const mockRepo = {
  findById: vi.fn(),
  findByName: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  updateName: vi.fn(),
  findByOwner: vi.fn(),
  inAnyRoutine: vi.fn(),
}

const mockCreateExercise = {
  execute: vi.fn(),
}

const mockRenameExercise = {
  execute: vi.fn(),
}

const mockDeleteExercise = {
  execute: vi.fn(),
}

const mockListExercises = {
  execute: vi.fn(),
}

const mockExercise = {
  id: { value: 1 },
  name: 'Squat',
  ownerId: { value: 1 },
}

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

vi.mock('@/features/exercise/exercise-repo-impl', () => ({
  createSqliteExerciseRepository: vi.fn(() => mockRepo),
}))

vi.mock('@/features/exercise/create-exercise', () => ({
  createExerciseUseCase: vi.fn(() => mockCreateExercise),
}))

vi.mock('@/features/exercise/rename-exercise', () => ({
  renameExerciseUseCase: vi.fn(() => mockRenameExercise),
}))

vi.mock('@/features/exercise/delete-exercise', () => ({
  deleteExerciseUseCase: vi.fn(() => mockDeleteExercise),
}))

vi.mock('@/features/exercise/list-exercises', () => ({
  listExercisesUseCase: vi.fn(() => mockListExercises),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('createExerciseAction', () => {
  it('returns success with exercise on valid input', async () => {
    mockCreateExercise.execute.mockReturnValue(mockExercise)

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction('Squat', 1)

    expect(result.success).toBe(true)
    expect(result.exercise).toEqual(mockExercise)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when exercise name is empty', async () => {
    mockCreateExercise.execute.mockImplementation(() => {
      throw new Error('Exercise name cannot be empty')
    })

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction('', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise name cannot be empty')
    expect(result.exercise).toBeUndefined()
  })

  it('returns failure for whitespace-only name', async () => {
    mockCreateExercise.execute.mockImplementation(() => {
      throw new Error('Exercise name cannot be empty')
    })

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction('   ', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise name cannot be empty')
  })

  it('returns failure for names over 100 characters', async () => {
    const longName = 'a'.repeat(101)
    mockCreateExercise.execute.mockImplementation(() => {
      throw new Error('Exercise name too long')
    })

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction(longName, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise name too long')
  })

  it('returns failure for database errors', async () => {
    mockCreateExercise.execute.mockImplementation(() => {
      throw new Error('Connection refused: ECONNREFUSED')
    })

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction('Squat', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused: ECONNREFUSED')
  })

  it('returns failure for non-string input', async () => {
    mockCreateExercise.execute.mockImplementation(() => {
      throw new Error('Exercise name cannot be empty')
    })

    const { createExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await createExerciseAction(null as unknown as string, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise name cannot be empty')
  })
})

describe('renameExerciseAction', () => {
  it('returns success with exercise on valid rename', async () => {
    const updatedExercise = { id: { value: 1 }, name: 'Back Squat', ownerId: { value: 1 } }
    mockRenameExercise.execute.mockReturnValue(updatedExercise)

    const { renameExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await renameExerciseAction(1, 'Back Squat', 1)

    expect(result.success).toBe(true)
    expect(result.exercise).toEqual(updatedExercise)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when exercise not found', async () => {
    mockRenameExercise.execute.mockImplementation(() => {
      throw new Error('Exercise not found')
    })

    const { renameExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await renameExerciseAction(999, 'New Name', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise not found')
    expect(result.exercise).toBeUndefined()
  })

  it('returns failure when not the owner', async () => {
    mockRenameExercise.execute.mockImplementation(() => {
      throw new Error('Only the owner can rename this exercise')
    })

    const { renameExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await renameExerciseAction(1, 'New Name', 2)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Only the owner can rename this exercise')
  })

  it('returns failure for empty new name', async () => {
    mockRenameExercise.execute.mockImplementation(() => {
      throw new Error('Name cannot be empty')
    })

    const { renameExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await renameExerciseAction(1, '', 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Name cannot be empty')
  })
})

describe('deleteExerciseAction', () => {
  it('returns success when exercise is deleted', async () => {
    mockDeleteExercise.execute.mockReturnValue(undefined)

    const { deleteExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await deleteExerciseAction(1, 1)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when exercise not found', async () => {
    mockDeleteExercise.execute.mockImplementation(() => {
      throw new Error('Exercise not found')
    })

    const { deleteExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await deleteExerciseAction(999, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise not found')
  })

  it('returns failure when not the owner', async () => {
    mockDeleteExercise.execute.mockImplementation(() => {
      throw new Error('Only the owner can delete this exercise')
    })

    const { deleteExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await deleteExerciseAction(1, 2)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Only the owner can delete this exercise')
  })

  it('returns failure when exercise is in a routine', async () => {
    mockDeleteExercise.execute.mockImplementation(() => {
      throw new Error('Cannot delete exercise that is part of a routine')
    })

    const { deleteExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await deleteExerciseAction(1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Cannot delete exercise that is part of a routine')
  })

  it('returns failure for database errors', async () => {
    mockDeleteExercise.execute.mockImplementation(() => {
      throw new Error('Connection refused')
    })

    const { deleteExerciseAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await deleteExerciseAction(1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})

describe('listExercisesAction', () => {
  it('returns exercise list on success', async () => {
    mockListExercises.execute.mockReturnValue([mockExercise])

    const { listExercisesAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await listExercisesAction()

    expect(result.success).toBe(true)
    expect(result.exercises).toEqual([mockExercise])
    expect(result.error).toBeUndefined()
  })

  it('returns empty array when no exercises exist', async () => {
    mockListExercises.execute.mockReturnValue([])

    const { listExercisesAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await listExercisesAction()

    expect(result.success).toBe(true)
    expect(result.exercises).toEqual([])
  })

  it('returns multiple exercises', async () => {
    const exercises = [
      { id: { value: 2 }, name: 'Bench Press', ownerId: { value: 1 } },
      { id: { value: 1 }, name: 'Squat', ownerId: { value: 1 } },
    ]
    mockListExercises.execute.mockReturnValue(exercises)

    const { listExercisesAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await listExercisesAction()

    expect(result.success).toBe(true)
    expect(result.exercises).toEqual(exercises)
  })

  it('returns failure for database errors', async () => {
    mockListExercises.execute.mockImplementation(() => {
      throw new Error('Connection refused')
    })

    const { listExercisesAction } = await import('@/features/exercise/exercise-server-actions')
    const result = await listExercisesAction()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})
