import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDb = {}

const mockDateModule = vi.hoisted(() => ({
  getTodayLocalDate: vi.fn(),
}))

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

const mockGetTodayExercises = {
  execute: vi.fn(),
}

const mockGetWorkoutHistory = {
  execute: vi.fn(),
}

const mockGetUserVolume = {
  execute: vi.fn(),
}

const mockDeleteWorkout = {
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

vi.mock('@/features/workout/get-today-exercises', () => ({
  getTodayExercisesUseCase: vi.fn(() => mockGetTodayExercises),
}))

vi.mock('@/features/workout/get-workout-history', () => ({
  getWorkoutHistoryUseCase: vi.fn(() => mockGetWorkoutHistory),
}))

vi.mock('@/features/workout/get-user-volume', () => ({
  getUserVolumeUseCase: vi.fn(() => mockGetUserVolume),
}))

vi.mock('@/features/workout/delete-workout', () => ({
  deleteWorkoutUseCase: vi.fn(() => mockDeleteWorkout),
}))

vi.mock('@/shared/utils/date', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/utils/date')>()
  return {
    ...actual,
    getTodayISO: vi.fn(actual.getTodayISO),
    getTodayLocalDate: mockDateModule.getTodayLocalDate,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockDateModule.getTodayLocalDate.mockReturnValue('2025-01-01')
  mockLogWorkout.execute.mockReset()
  mockGetTodayExercises.execute.mockReset()
  mockGetWorkoutHistory.execute.mockReset()
  mockGetUserVolume.execute.mockReset()
})

const executedCases: string[] = []
const executedByBlock = new Map<string, number>()

afterEach(() => {
  const { currentTestName } = expect.getState()
  if (typeof currentTestName !== 'string') return
  executedCases.push(currentTestName)
  const block = currentTestName.split(' > ')[0]
  executedByBlock.set(block, (executedByBlock.get(block) ?? 0) + 1)
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
        { id: 's1', weight: 100, reps: 5, count: undefined },
        { id: 's2', weight: 135, reps: 3, count: undefined },
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
})

describe('getTodayWorkoutsAction — counted sets', () => {
  beforeEach(() => {
    mockWorkoutRepo.findByDate.mockReset()
    mockGetTodayExercises.execute.mockReset()
  })

  it('carries id and count of a counted line into the client shape', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result).toEqual({
      success: true,
      workouts: { 5: [{ id: 's1', weight: 135, reps: 5, count: 3 }] },
      logIds: { 5: 1 },
    })
  })

  it('leaves a legacy line count undefined rather than defaulting it to 1', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)
    const line = result.workouts![5][0]

    expect(result.success).toBe(true)
    expect(line.id).toBe('s1')
    expect(line.weight).toBe(135)
    expect(line.reps).toBe(5)
    expect(line.count).toBeUndefined()
    expect(line.count).not.toBe(1)
  })

  it.each([
    { label: 'a counted line', count: 3, expected: 3 },
    { label: 'a fractional count', count: 2.7, expected: 2.7 },
    { label: 'a zero count', count: 0, expected: 0 },
  ])(
    'passes $label through verbatim, neither floored nor defaulted',
    async ({ count, expected }) => {
      mockWorkoutRepo.findByDate.mockReturnValue([
        {
          id: 1,
          userId: 1,
          exerciseId: 5,
          date: '2025-01-01',
          sets: [{ id: 's1', reps: 5, weight: 135, count }],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ])

      const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
      const result = await getTodayWorkoutsAction(1)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.workouts![5][0].count).toBe(expected)
      expect(result.workouts).toEqual({
        5: [{ id: 's1', weight: 135, reps: 5, count: expected }],
      })
    },
  )

  it('keys each log by its own exercise id with its own lines', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        userId: 1,
        exerciseId: 9,
        date: '2025-01-01',
        sets: [
          { id: 's2', reps: 8, weight: 95 },
          { id: 's3', reps: 2, weight: 60, count: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(Object.keys(result.workouts!).sort()).toEqual(['5', '9'])
    expect(result.workouts![5]).toEqual([{ id: 's1', weight: 135, reps: 5, count: 3 }])
    expect(result.workouts![9]).toEqual([
      { id: 's2', weight: 95, reps: 8, count: undefined },
      { id: 's3', weight: 60, reps: 2, count: 1 },
    ])
  })

  // Log ids (11, 27) share no value with any exercise id (5, 9) or set id ('s1'..'s3'),
  // so a wrong key, a swapped pairing, or a set id written where the log id belongs all fail this pin.
  it('maps each exercise id to its own log id from the same read, while its rows carry set ids', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 11,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 27,
        userId: 1,
        exerciseId: 9,
        date: '2025-01-01',
        sets: [
          { id: 's2', reps: 8, weight: 95, count: 2 },
          { id: 's3', reps: 1, weight: 60 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result).toEqual({
      success: true,
      workouts: {
        5: [{ id: 's1', weight: 135, reps: 5, count: 3 }],
        9: [
          { id: 's2', weight: 95, reps: 8, count: 2 },
          { id: 's3', weight: 60, reps: 1, count: undefined },
        ],
      },
      logIds: { 5: 11, 9: 27 },
    })
    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledTimes(1)
  })

  it('lets the later log win the key when two logs share one exercise id', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'first', reps: 5, weight: 135, count: 1 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 'second', reps: 3, weight: 145, count: 2 }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(Object.keys(result.workouts!)).toEqual(['5'])
    expect(result.workouts![5]).toEqual([{ id: 'second', weight: 145, reps: 3, count: 2 }])
  })

  it('returns an empty object, not null and not undefined, when there are no logs today', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.workouts).toEqual({})
    expect(result.workouts).not.toBeNull()
    expect(result.workouts).toBeDefined()
  })

  it('returns the failure envelope with the message and null workouts on an Error', async () => {
    mockWorkoutRepo.findByDate.mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result).toEqual({
      success: false,
      workouts: null,
      error: 'Database connection lost',
    })
  })

  it('returns the failure envelope with Unknown error on a non-Error throw', async () => {
    mockWorkoutRepo.findByDate.mockImplementation(() => {
      throw 'boom'
    })

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result).toEqual({ success: false, workouts: null, error: 'Unknown error' })
  })

  it('asks the repository for today as a YYYY-MM-DD string', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(1)

    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledTimes(1)
    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledWith(
      1,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
  })

  it('emits exactly the four wire keys and leaks nothing from the stored log', async () => {
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [{ id: 's1', reps: 5, weight: 135, count: 3, volume: 405, notes: 'x' }],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(Object.keys(result.workouts![5][0]).sort()).toEqual(['count', 'id', 'reps', 'weight'])
  })

  it('emits the identical line shape on both Today wires for the same fixture', async () => {
    const storedLine = { id: 's1', reps: 5, weight: 135, count: 3 }
    mockWorkoutRepo.findByDate.mockReturnValue([
      {
        id: 1,
        userId: 1,
        exerciseId: 5,
        date: '2025-01-01',
        sets: [storedLine],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ])
    mockGetTodayExercises.execute.mockReturnValue([
      { exerciseId: 5, exerciseName: 'Squat', lastLog: [storedLine] },
    ])

    const { getTodayWorkoutsAction, getTodayExercisesAction } = await import(
      '@/features/workout/workout-server-actions'
    )
    const workoutsResult = await getTodayWorkoutsAction(1)
    const exercisesResult = await getTodayExercisesAction(1, 0)

    const workoutsLine = workoutsResult.workouts![5][0]
    const exercisesLine = exercisesResult.exercises![0].lastLog![0]

    expect(workoutsLine).toEqual(exercisesLine)
    expect(workoutsLine).toEqual({ id: 's1', weight: 135, reps: 5, count: 3 })
    expect(exercisesLine).toEqual({ id: 's1', weight: 135, reps: 5, count: 3 })
    expect(Object.keys(workoutsLine).sort()).toEqual(Object.keys(exercisesLine).sort())
  })
})

const SURVIVING_BLOCKS = [
  { block: 'logWorkoutAction', atLeast: 5 },
  { block: 'getTodayExercisesAction', atLeast: 4 },
  { block: 'getHistoryAction', atLeast: 4 },
  { block: 'getTodayWorkoutsAction', atLeast: 4 },
  { block: 'getTodayWorkoutsAction — counted sets', atLeast: 13 },
]

describe('the removed workout update write path', () => {
  it('exports exactly the five surviving actions', async () => {
    const actions = await import('@/features/workout/workout-server-actions')

    expect(Object.keys(actions).sort()).toEqual([
      'deleteWorkoutAction',
      'getHistoryAction',
      'getTodayExercisesAction',
      'getTodayWorkoutsAction',
      'logWorkoutAction',
    ])
  })

  it('refuses to resolve the removed specifier while its surviving sibling still resolves', async () => {
    const removed = ['@/features/workout', 'update-workout'].join('/')
    const surviving = ['@/features/workout', 'workout-entity'].join('/')

    await expect(import(removed)).rejects.toThrow()
    await expect(import(surviving)).resolves.toHaveProperty('validateSet')
  })

  it('collects and runs every surviving describe block and no removed one', () => {
    for (const { block, atLeast } of SURVIVING_BLOCKS) {
      const ran = executedByBlock.get(block) ?? 0
      expect(ran, `describe block under-ran: ${block}`).toBeGreaterThanOrEqual(atLeast)
    }
    expect(executedByBlock.has('updateWorkoutAction')).toBe(false)
    expect(executedCases.filter((name) => name.startsWith('updateWorkoutAction'))).toEqual([])
  })
})

describe('getTodayWorkoutsAction — which calendar day it asks for', () => {
  const LOCAL_SENTINEL = '2026-11-25'
  const OTHER_LOCAL_SENTINEL = '2027-03-07'
  const FROZEN_UTC_INSTANT = '2026-11-27T23:30:00.000Z'

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks the repository for exactly the day getTodayLocalDate returned', async () => {
    mockDateModule.getTodayLocalDate.mockReturnValue(LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const result = await getTodayWorkoutsAction(1)

    expect(result.success).toBe(true)
    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledTimes(1)
    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledWith(1, LOCAL_SENTINEL)
  })

  it('never asks the repository for the UTC calendar day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FROZEN_UTC_INSTANT))
    const utcToday = new Date().toISOString().split('T')[0]
    mockDateModule.getTodayLocalDate.mockReturnValue(LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(1)

    expect(utcToday).not.toBe(LOCAL_SENTINEL)
    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledWith(1, LOCAL_SENTINEL)
    expect(mockWorkoutRepo.findByDate).not.toHaveBeenCalledWith(1, utcToday)
  })

  it('forwards a different sentinel verbatim rather than recomputing a date', async () => {
    mockDateModule.getTodayLocalDate.mockReturnValue(OTHER_LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(1)

    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledWith(1, OTHER_LOCAL_SENTINEL)
  })

  it('never reads the UTC helper getTodayISO', async () => {
    mockDateModule.getTodayLocalDate.mockReturnValue(LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(1)
    const dateModule = await import('@/shared/utils/date')

    expect(dateModule.getTodayISO).not.toHaveBeenCalled()
  })

  it('reads the local clock exactly once per invocation', async () => {
    mockDateModule.getTodayLocalDate.mockReturnValue(LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(1)

    expect(mockDateModule.getTodayLocalDate).toHaveBeenCalledTimes(1)
  })

  it('forwards the user id untouched as the first argument', async () => {
    mockDateModule.getTodayLocalDate.mockReturnValue(LOCAL_SENTINEL)
    mockWorkoutRepo.findByDate.mockReturnValue([])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    await getTodayWorkoutsAction(42)

    expect(mockWorkoutRepo.findByDate).toHaveBeenCalledWith(42, LOCAL_SENTINEL)
  })
})

// deleteWorkoutAction is the branch's only untested write path, and a destructive one: it is the
// code that removes a user's workout_logs row. What is pinned here is the action's own
// encapsulation — the (userId, logId) -> execute(logId, userId) argument reversal across two
// same-typed numbers, the success/failure envelope the Today page reads, and that the delete
// reaches the database only through the ownership-checked use case. The ownership rule itself and
// the two messages it rejects with are pinned by tests/unit/features/workout/delete-workout.spec.ts
// and are deliberately not re-asserted here.
describe('deleteWorkoutAction', () => {
  // Distinct on purpose: userId and logId are both `number`, so equal sentinels would let a
  // swapped or duplicated call pass. 7 and 203 collide with nothing in this file.
  const CALLER_ID = 7
  const LOG_ID = 203

  beforeEach(() => {
    mockDeleteWorkout.execute.mockReset()
    mockWorkoutRepo.findById.mockReset()
    mockWorkoutRepo.delete.mockReset()
  })

  it('returns exactly { success: true } and no error key when the delete is accepted', async () => {
    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')

    const result = await deleteWorkoutAction(CALLER_ID, LOG_ID)

    expect(result).toStrictEqual({ success: true })
    expect(mockDeleteWorkout.execute).toHaveBeenCalledTimes(1)
  })

  it('hands the use case (logId, userId) — reversed against the action signature, in that order', async () => {
    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')

    await deleteWorkoutAction(CALLER_ID, LOG_ID)

    expect(mockDeleteWorkout.execute).toHaveBeenCalledWith(LOG_ID, CALLER_ID)
  })

  it('builds the use case on the workout repository made from the database singleton', async () => {
    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')

    await deleteWorkoutAction(CALLER_ID, LOG_ID)

    const { createSqliteWorkoutRepository } = await import('@/features/workout/workout-repo-impl')
    const { deleteWorkoutUseCase } = await import('@/features/workout/delete-workout')

    expect(createSqliteWorkoutRepository).toHaveBeenCalledWith(mockDb)
    expect(deleteWorkoutUseCase).toHaveBeenCalledWith(mockWorkoutRepo)
  })

  it('never touches the row through the repository itself — the delete goes only via the use case', async () => {
    const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')

    await deleteWorkoutAction(CALLER_ID, LOG_ID)

    expect(mockWorkoutRepo.delete).not.toHaveBeenCalled()
    expect(mockWorkoutRepo.findById).not.toHaveBeenCalled()
  })

  // The two messages are the ones deleteWorkoutUseCase actually throws; pinning them verbatim is
  // what proves the page receives a refusal as a message rather than as a silent success.
  it.each([
    { name: 'a log that does not exist', message: 'Workout log not found' },
    { name: 'a log owned by another user', message: 'Only the owner can delete this workout log' },
  ])(
    'reports $name as a failed envelope carrying the use case message verbatim',
    async ({ message }) => {
      mockDeleteWorkout.execute.mockImplementation(() => {
        throw new Error(message)
      })

      const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
      const result = await deleteWorkoutAction(CALLER_ID, LOG_ID)

      expect(result).toStrictEqual({ success: false, error: message })
    },
  )

  it.each([
    { name: 'a string', thrown: 'string error' },
    { name: 'undefined', thrown: undefined },
  ])(
    'reports a throw of $name as Unknown error rather than reading a property off it',
    async ({ thrown }) => {
      mockDeleteWorkout.execute.mockImplementation(() => {
        throw thrown
      })

      const { deleteWorkoutAction } = await import('@/features/workout/workout-server-actions')
      const result = await deleteWorkoutAction(CALLER_ID, LOG_ID)

      expect(result).toStrictEqual({ success: false, error: 'Unknown error' })
    },
  )
})

