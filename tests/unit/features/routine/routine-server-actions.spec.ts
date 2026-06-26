import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDb = {}

const mockRepo = {
  exerciseExists: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findByUserAndDay: vi.fn(),
  findByUserExerciseAndDay: vi.fn(),
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

vi.mock('@/features/routine/routine-repo-impl', () => ({
  createSqliteRoutineRepository: vi.fn(() => mockRepo),
}))

vi.mock('@/features/routine/assign-exercise', () => ({
  assignExerciseUseCase: vi.fn(() => mockAssignExercise),
}))

vi.mock('@/features/routine/remove-exercise', () => ({
  removeExerciseUseCase: vi.fn(() => mockRemoveExercise),
}))

vi.mock('@/features/routine/get-user-routine', () => ({
  getUserRoutineUseCase: vi.fn(() => mockGetUserRoutine),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAssignExercise.execute.mockReset()
  mockRemoveExercise.execute.mockReset()
  mockGetUserRoutine.execute.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('assignExerciseAction', () => {
  it('returns success with assignment on valid input', async () => {
    mockAssignExercise.execute.mockReturnValue(mockAssignment)

    const { assignExerciseAction } = await import('@/features/routine/routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(true)
    expect(result.assignment).toEqual(mockAssignment)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when exercise not found', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('Exercise not found')
    })

    const { assignExerciseAction } = await import('@/features/routine/routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Exercise not found')
    expect(result.assignment).toBeUndefined()
  })

  it('returns failure when duplicate assignment exists', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('This exercise is already assigned to this day')
    })

    const { assignExerciseAction } = await import('@/features/routine/routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBe('This exercise is already assigned to this day')
    expect(result.assignment).toBeUndefined()
  })

  it('returns failure for invalid day', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('Invalid day of week: NotADay')
    })

    const { assignExerciseAction } = await import('@/features/routine/routine-server-actions')
    const result = await assignExerciseAction(1, 5, 'NotADay' as any)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid day of week: NotADay')
  })

  it('returns failure for invalid userId', async () => {
    mockAssignExercise.execute.mockImplementation(() => {
      throw new Error('userId must be a non-negative integer')
    })

    const { assignExerciseAction } = await import('@/features/routine/routine-server-actions')
    const result = await assignExerciseAction(-1, 5, 'Monday')

    expect(result.success).toBe(false)
    expect(result.error).toBe('userId must be a non-negative integer')
  })
})

describe('removeAssignmentAction', () => {
  it('returns success on valid deletion', async () => {
    mockRemoveExercise.execute.mockReturnValue(undefined)

    const { removeAssignmentAction } = await import('@/features/routine/routine-server-actions')
    const result = await removeAssignmentAction(1, 42)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when assignment not found', async () => {
    mockRemoveExercise.execute.mockImplementation(() => {
      throw new Error('Routine assignment not found')
    })

    const { removeAssignmentAction } = await import('@/features/routine/routine-server-actions')
    const result = await removeAssignmentAction(1, 999)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Routine assignment not found')
  })

  it('returns failure when assignment belongs to another user', async () => {
    mockRemoveExercise.execute.mockImplementation(() => {
      throw new Error('Routine assignment not found')
    })

    const { removeAssignmentAction } = await import('@/features/routine/routine-server-actions')
    const result = await removeAssignmentAction(1, 42)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Routine assignment not found')
  })

  it('returns failure for invalid assignmentId', async () => {
    mockRemoveExercise.execute.mockImplementation(() => {
      throw new Error('Routine assignment not found')
    })

    const { removeAssignmentAction } = await import('@/features/routine/routine-server-actions')
    const result = await removeAssignmentAction(1, -1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Routine assignment not found')
  })
})

describe('getUserRoutineAction', () => {
  it('returns success with routine on valid input', async () => {
    mockGetUserRoutine.execute.mockReturnValue(mockRoutine)

    const { getUserRoutineAction } = await import('@/features/routine/routine-server-actions')
    const result = await getUserRoutineAction(1)

    expect(result.success).toBe(true)
    expect(result.routine).toEqual(mockRoutine)
    expect(result.error).toBeUndefined()
  })

  it('returns empty routine when user has no assignments', async () => {
    mockGetUserRoutine.execute.mockReturnValue({})

    const { getUserRoutineAction } = await import('@/features/routine/routine-server-actions')
    const result = await getUserRoutineAction(999)

    expect(result.success).toBe(true)
    expect(result.routine).toEqual({})
  })

  it('returns error when getUserRoutineUseCase throws', async () => {
    mockGetUserRoutine.execute.mockImplementation(() => {
      throw new Error('User not found')
    })

    const { getUserRoutineAction } = await import('@/features/routine/routine-server-actions')
    const result = await getUserRoutineAction(999)

    expect(result.success).toBe(false)
    expect(result.error).toBe('User not found')
  })
})
