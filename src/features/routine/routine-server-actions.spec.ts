import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDb = {}

const mockRepo = {
  exerciseExists: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findByUserAndDay: vi.fn(),
  findAllByUser: vi.fn(),
  findAllByUserGroupedByDay: vi.fn(),
  delete: vi.fn(),
}

const mockAssignExercise = {
  execute: vi.fn(),
}

const mockRemoveExercise = {
  execute: vi.fn(),
}

const mockGetUserRoutine = {
  execute: vi.fn(),
}

const mockAssignment = {
  id: { value: 1 },
  userId: 1,
  exerciseId: 5,
  dayOfWeek: 'Monday',
}

const mockRoutine = {
  Monday: [{ id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' }],
}

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

vi.mock('./routine-repo-impl', () => ({
  createSqliteRoutineRepository: vi.fn(() => mockRepo),
}))

vi.mock('./assign-exercise', () => ({
  assignExerciseUseCase: vi.fn(() => mockAssignExercise),
}))

vi.mock('./remove-exercise', () => ({
  removeExerciseUseCase: vi.fn(() => mockRemoveExercise),
}))

vi.mock('./get-user-routine', () => ({
  getUserRoutineUseCase: vi.fn(() => mockGetUserRoutine),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('assignExerciseAction', () => {
  it('returns success with assignment on valid input', async () => {
    mockAssignExercise.execute.mockReturnValue(mockAssignment)

    const { assignExerciseAction } = await import('./routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(true)
    expect(result.assignment).toEqual(mockAssignment)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when exercise not found', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('Exercise not found')
    })

    const { assignExerciseAction } = await import('./routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise not found')
    expect(result.assignment).toBeUndefined()
  })

  it('returns failure when duplicate assignment exists', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('An exercise is already assigned to this day')
    })

    const { assignExerciseAction } = await import('./routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBe('An exercise is already assigned to this day')
    expect(result.assignment).toBeUndefined()
  })

  it('returns failure for invalid day', async () => {
    const { assignExerciseAction } = await import('./routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'NotADay' as any)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns failure for invalid userId', async () => {
    const { assignExerciseAction } = await import('./routine-server-actions')
    const result = await assignExerciseAction(-1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('removeExerciseAction', () => {
  it('returns success on valid deletion', async () => {
    mockRemoveExercise.execute.mockReturnValue(undefined)

    const { removeExerciseAction } = await import('./routine-server-actions')
    const result = await removeExerciseAction(42)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when assignment not found', async () => {
    mockRemoveExercise.execute.mockImplementation(() => {
      throw new Error('Routine assignment not found')
    })

    const { removeExerciseAction } = await import('./routine-server-actions')
    const result = await removeExerciseAction(999)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Routine assignment not found')
  })

  it('returns failure for invalid assignmentId', async () => {
    const { removeExerciseAction } = await import('./routine-server-actions')
    const result = await removeExerciseAction(-1)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('getUserRoutineAction', () => {
  it('returns success with routine on valid input', async () => {
    mockGetUserRoutine.execute.mockReturnValue(mockRoutine)

    const { getUserRoutineAction } = await import('./routine-server-actions')
    const result = await getUserRoutineAction(1)

    expect(result.success).toBe(true)
    expect(result.routine).toEqual(mockRoutine)
    expect(result.error).toBeUndefined()
  })

  it('returns empty routine when user has no assignments', async () => {
    mockGetUserRoutine.execute.mockReturnValue({})

    const { getUserRoutineAction } = await import('./routine-server-actions')
    const result = await getUserRoutineAction(999)

    expect(result.success).toBe(true)
    expect(result.routine).toEqual({})
  })

  it('returns empty routine for userId with no assignments', async () => {
    mockGetUserRoutine.execute.mockReturnValue({})

    const { getUserRoutineAction } = await import('./routine-server-actions')
    const result = await getUserRoutineAction(999)

    expect(result.success).toBe(true)
    expect(result.routine).toEqual({})
  })
})
