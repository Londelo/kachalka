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
  findLatestForExercise: vi.fn(),
  findHistoryByDate: vi.fn(),
}

const mockRoutineRepo = {
  findById: vi.fn(),
  findByUserAndDay: vi.fn(),
  findByUserExerciseAndDay: vi.fn(),
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

const mockGetTodayExercises = {
  execute: vi.fn(),
}

const mockGetWorkoutHistory = {
  execute: vi.fn(),
}

const mockGetUserVolume = {
  execute: vi.fn(),
}

const mockLog = {
  id: { value: 1 },
  userId: 1,
  exerciseId: 5,
  date: '2025-01-01',
  sets: [{ id: 's1', reps: 5, weight: 100 }],
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

vi.mock('@/features/workout/get-today-exercises', () => ({
  getTodayExercisesUseCase: vi.fn(() => mockGetTodayExercises),
}))

vi.mock('@/features/workout/get-workout-history', () => ({
  getWorkoutHistoryUseCase: vi.fn(() => mockGetWorkoutHistory),
}))

vi.mock('@/features/workout/get-user-volume', () => ({
  getUserVolumeUseCase: vi.fn(() => mockGetUserVolume),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockLogWorkout.execute.mockReset()
  mockUpdateWorkout.execute.mockReset()
  mockGetTodayExercises.execute.mockReset()
  mockGetWorkoutHistory.execute.mockReset()
  mockGetUserVolume.execute.mockReset()
})

describe('logWorkoutAction', () => {
  it('returns success on valid log', async () => {
    mockLogWorkout.execute.mockReturnValue(mockLog)

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])

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
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: -10 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Weight must be non-negative')
  })

  it('returns failure for database errors', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw new Error('Connection refused')
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })

  it('returns failure when error is non-string', async () => {
    mockLogWorkout.execute.mockImplementation(() => {
      throw 'string error'
    })

    const { logWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await logWorkoutAction(1, 5, '2025-01-01', [{ id: 's1', reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

describe('updateWorkoutAction', () => {
  it('returns success on valid update', async () => {
    mockUpdateWorkout.execute.mockReturnValue(mockLog)

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ id: 's1', reps: 5, weight: 110 }])

    expect(result.success).toBe(true)
    expect(result.log).toEqual(mockLog)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when log not found', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Workout log not found')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(999, 1, [{ id: 's1', reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Workout log not found')
  })

  it('returns failure when not the owner', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Only the owner can update this workout log')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ id: 's1', reps: 5, weight: 100 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Only the owner can update this workout log')
  })

  it('returns failure for invalid sets', async () => {
    mockUpdateWorkout.execute.mockImplementation(() => {
      throw new Error('Weight must be non-negative')
    })

    const { updateWorkoutAction } = await import('@/features/workout/workout-server-actions')
    const result = await updateWorkoutAction(1, 1, [{ id: 's1', reps: 5, weight: -10 }])

    expect(result.success).toBe(false)
    expect(result.error).toBe('Weight must be non-negative')
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

describe('getHistoryAction', () => {
  it('returns history on success', async () => {
    const mockHistory = [
      {
        date: '2025-01-08',
        logs: [
          {
            id: 2,
            exerciseId: 5,
            exerciseName: 'Squat',
            sets: [{ id: 's1', reps: 5, weight: 105 }],
            volume: 525,
          },
        ],
      },
    ]
    mockGetWorkoutHistory.execute.mockReturnValue(mockHistory)

    const { getHistoryAction } = await import('@/features/workout/workout-server-actions')
    const result = await getHistoryAction(1)

    expect(result.success).toBe(true)
    expect(result.history).toEqual(mockHistory)
    expect(result.error).toBeUndefined()
  })

  it('returns empty array when user has no history', async () => {
    mockGetWorkoutHistory.execute.mockReturnValue([])

    const { getHistoryAction } = await import('@/features/workout/workout-server-actions')
    const result = await getHistoryAction(1)

    expect(result.success).toBe(true)
    expect(result.history).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('returns error on failure', async () => {
    mockGetWorkoutHistory.execute.mockImplementation(() => {
      throw new Error('Database error')
    })

    const { getHistoryAction } = await import('@/features/workout/workout-server-actions')
    const result = await getHistoryAction(1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database error')
    expect(result.history).toBeUndefined()
  })

  it('returns Unknown error for non-Error exceptions', async () => {
    mockGetWorkoutHistory.execute.mockImplementation(() => {
      throw 'string error'
    })

    const { getHistoryAction } = await import('@/features/workout/workout-server-actions')
    const result = await getHistoryAction(1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

describe('getTodayWorkoutsAction', () => {
  it('returns workouts on success', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 100 }, { id: 's2', reps: 3, weight: 135 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({
      5: [
        { weight: 100, reps: 5, count: 1 },
        { weight: 135, reps: 3, count: 1 },
      ],
    })
    expect(result.error).toBeUndefined()
  })

  it('returns empty object when no workouts today', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({})
    expect(result.error).toBeUndefined()
  })

  it('returns error on failure', async () => {
    mockWorkoutRepo.findByDate.mockImplementation(() => {
      throw new Error('Database error')
    })

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database error')
    expect(result.workouts).toBeNull()
  })

  it('returns Unknown error for non-Error exceptions', async () => {
    mockWorkoutRepo.findByDate.mockImplementation(() => {
      throw 'string error'
    })

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })

  it('projects a stored count unchanged', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({ 7: [{ weight: 135, reps: 5, count: 3 }] })
    expect(result.error).toBeUndefined()
  })

  it.each([
    { label: 'a missing count key', stored: { id: 's1', reps: 5, weight: 100 } },
    { label: 'an undefined count', stored: { id: 's1', reps: 5, weight: 100, count: undefined } },
    { label: 'a zero count', stored: { id: 's1', reps: 5, weight: 100, count: 0 } },
  ])('projects $label as a count of 1', async ({ stored }) => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [stored],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({ 7: [{ weight: 100, reps: 5, count: 1 }] })
    expect(result.error).toBeUndefined()
  })

  it('gives each exercise its own key with its own counts', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 2 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        userId: 1,
        exerciseId: 9,
        date: '2025-01-01',
        sets: [{ id: 's2', reps: 8, weight: 95 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({
      7: [{ weight: 135, reps: 5, count: 2 }],
      9: [{ weight: 95, reps: 8, count: 1 }],
    })
    expect(result.error).toBeUndefined()
  })

  it('preserves order and length across a multi-line exercise', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [
          { id: 's1', reps: 5, weight: 135, count: 3 },
          { id: 's2', reps: 3, weight: 95 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.workouts?.[7]).toHaveLength(2)
    expect(result.workouts).toEqual({
      7: [
        { weight: 135, reps: 5, count: 3 },
        { weight: 95, reps: 3, count: 1 },
      ],
    })
  })

  it('projects an empty sets array to an empty array', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.workouts).toEqual({ 7: [] })
    expect(result.error).toBeUndefined()
  })

  it('returns the full failure envelope for a non-Error throw', async () => {
    mockWorkoutRepo.findByDate.mockImplementation(() => {
      throw 'string error'
    })

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result).toEqual({ success: false, error: 'Unknown error', workouts: null })
  })

  it('projects only weight, reps and count — never the id or any other stored field', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 7,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3, note: 'tight bar' }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.workouts).toEqual({ 7: [{ weight: 135, reps: 5, count: 3 }] })
    expect(Object.keys(result.workouts![7][0]).sort()).toEqual(['count', 'reps', 'weight'])
  })
})

