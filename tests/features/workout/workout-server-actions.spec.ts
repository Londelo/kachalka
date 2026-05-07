import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {}

const mockWorkoutRepo = {
  findById: vi.fn(),
  create: vi.fn(),
  findByDateAndExercise: vi.fn(),
  findByDate: vi.fn(),
  findAllByUser: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByDayOfWeek: vi.fn(),
}

const mockRoutineRepo = {
  findById: vi.fn(),
  findByUserAndDay: vi.fn(),
  findAllByUser: vi.fn(),
  findAllByUserGroupedByDay: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  exerciseExists: vi.fn(),
}

const mockLogWorkout = {
  execute: vi.fn(),
}

const mockUpdateWorkout = {
  execute: vi.fn(),
}

const mockDeleteWorkout = {
  execute: vi.fn(),
}

const mockGetTodayExercises = {
  execute: vi.fn(),
}

const mockLog = {
  id: { value: 1 },
  userId: 1,
  exerciseId: 5,
  date: '2025-01-01',
  sets: [{ reps: 5, weight: 100 }],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const mockExercises = [
  { exerciseId: 5, exerciseName: 'Squat', lastLog: null },
]

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

vi.mock('@/features/workout/workout-repo-impl', () => ({
  createSqliteWorkoutRepository: vi.fn(() => mockWorkoutRepo),
}))

vi.mock('@/features/routine/routine-repo-impl', () => ({
  createSqliteRoutineRepository: vi.fn(() => mockRoutineRepo),
}))

vi.mock('@/features/workout/log-workout', () => ({
  logWorkoutUseCase: vi.fn(() => mockLogWorkout),
}))

vi.mock('@/features/workout/update-workout', () => ({
  updateWorkoutUseCase: vi.fn(() => mockUpdateWorkout),
}))

vi.mock('@/features/workout/delete-workout', () => ({
  deleteWorkoutUseCase: vi.fn(() => mockDeleteWorkout),
}))

vi.mock('@/features/workout/get-today-exercises', () => ({
  getTodayExercisesUseCase: vi.fn(() => mockGetTodayExercises),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockLogWorkout.execute.mockReset()
  mockUpdateWorkout.execute.mockReset()
  mockDeleteWorkout.execute.mockReset()
  mockGetTodayExercises.execute.mockReset()
})

describe('logWorkoutAction', () => {
  it('returns success on valid log', async () => {
    mockLogWorkout.execute.mockReturnValue(mockLog)

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ reps: 5, weight: 100 }])

    expect(result.success).toBe(true)
    expect(result.log).toEqual(mockLog)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when sets are invalid', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw new Error('Must log at least one set')
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Must log at least one set')
    expect(result.log).toBeUndefined()
  })

  it('returns failure when weight is invalid', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw new Error('Weight must be non-negative')
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ reps: 5, weight: -10 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Weight must be non-negative')
  })

  it('returns failure for database errors', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw new Error('Connection refused')
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })

  it('returns failure when error is non-string', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw 'string error'
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

describe('updateWorkoutAction', () => {
  it('returns success on valid update', async () => {
    mockUpdateWorkout.execute.mockReturnValue(mockLog)

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ reps: 5, weight: 110 }])

    expect(result.success).toBe(true)
    expect(result.log).toEqual(mockLog)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when log not found', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Workout log not found')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(999, 1, [{ reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Workout log not found')
  })

  it('returns failure when not the owner', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Only the owner can update this workout log')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Only the owner can update this workout log')
  })

  it('returns failure for invalid sets', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Weight must be non-negative')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ reps: 5, weight: -10 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Weight must be non-negative')
  })
})

describe('deleteWorkoutAction', () => {
  it('returns success on valid delete', async () => {
    mockDeleteWorkout.execute.mockReturnValue(undefined)

    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await deleteWorkoutAction(1, 1)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when log not found', async () => {
    mockDeleteWorkout.execute.mockImplementation(() => {
      throw new Error('Workout log not found')
    })

    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await deleteWorkoutAction(999, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Workout log not found')
  })

  it('returns failure when not the owner', async () => {
    mockDeleteWorkout.execute.mockImplementation(() => {
      throw new Error('Only the owner can delete this workout log')
    })

    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await deleteWorkoutAction(1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Only the owner can delete this workout log')
  })

  it('returns failure for database errors', async () => {
    mockDeleteWorkout.execute.mockImplementation(() => {
      throw new Error('Connection refused')
    })

    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await deleteWorkoutAction(1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})

describe('getTodayExercisesAction', () => {
  it('returns exercises on success', async () => {
    mockGetTodayExercises.execute.mockReturnValue(mockExercises)

    const { getTodayExercisesAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayExercisesAction(1, 0)

    expect(result.success).toBe(true)
    expect(result.exercises).toEqual(mockExercises)
    expect(result.error).toBeUndefined()
  })

  it('returns empty array when no exercises', async () => {
    mockGetTodayExercises.execute.mockReturnValue([])

    const { getTodayExercisesAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayExercisesAction(1, 0)

    expect(result.success).toBe(true)
    expect(result.exercises).toEqual([])
  })

  it('returns failure when routine query fails', async () => {
    mockGetTodayExercises.execute.mockImplementation(() => {
      throw new Error('Database error')
    })

    const { getTodayExercisesAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayExercisesAction(1, 0)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database error')
    expect(result.exercises).toBeNull()
  })

  it('returns failure when error is non-string', async () => {
    mockGetTodayExercises.execute.mockImplementation(() => {
      throw 'string error'
    })

    const { getTodayExercisesAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayExercisesAction(1, 0)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})
