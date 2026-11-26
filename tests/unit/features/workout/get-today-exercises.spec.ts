import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

function makeWorkoutRepo(overrides?: Partial<WorkoutRepository>) {
  return {
    findById: vi.fn(),
    create: vi.fn(),
    findByDateAndExercise: vi.fn(),
    findByDate: vi.fn(),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByDayOfWeek: vi.fn(),
    findLatestForExercise: vi.fn(),
    ...overrides,
  } as unknown as any
}

function makeRoutineRepo(overrides?: Partial<RoutineRepository>) {
  return {
    findById: vi.fn(),
    findByUserAndDay: vi.fn(),
    findByUserExerciseAndDay: vi.fn(),
    findAllByUser: vi.fn(),
    findAllByUserGroupedByDay: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    exerciseExists: vi.fn(),
    ...overrides,
  } as unknown as any
}

function makeExerciseRepo(overrides?: Partial<ExerciseRepository>) {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    updateName: vi.fn(),
    delete: vi.fn(),
    findByOwner: vi.fn(),
    inAnyRoutine: vi.fn(),
    ...overrides,
  } as unknown as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getTodayExercisesUseCase', () => {
  it('returns exercises for today day-of-week', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
      { id: { value: 2 }, userId: 1, exerciseId: 10, dayOfWeek: 'Wednesday' },
    ])

    exerciseRepo.findById.mockReturnValue({ id: { value: 5 }, name: 'Bench Press' })

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0) // Monday = 0

    expect(result).toHaveLength(1)
    expect(result[0].exerciseId).toBe(5)
    expect(result[0].exerciseName).toBe('Bench Press')
  })

  it('returns empty array when no exercises assigned', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([])

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0)

    expect(result).toEqual([])
  })

  it('returns all sets in lastLog as an array', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
    ])

    exerciseRepo.findById.mockReturnValue({ id: { value: 5 }, name: 'Bench Press' })
    workoutRepo.findLatestForExercise.mockReturnValue({
      id: 1,
      sets: [
        { id: 's1', weight: 225, reps: 10 },
        { id: 's2', weight: 235, reps: 8 },
        { id: 's3', weight: 225, reps: 10 },
      ],
    })

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0)

    // toStrictEqual, not toEqual: a legacy line carries no count key, so a stamped
    // `count: 1` (or a dropped `id`) must fail here rather than be forgiven.
    expect(result[0].lastLog).toStrictEqual([
      { id: 's1', weight: 225, reps: 10, count: undefined },
      { id: 's2', weight: 235, reps: 8, count: undefined },
      { id: 's3', weight: 225, reps: 10, count: undefined },
    ])
  })

  it('returns null lastLog when no previous workout', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
    ])

    exerciseRepo.findById.mockReturnValue({ id: { value: 5 }, name: 'Bench Press' })
    workoutRepo.findLatestForExercise.mockReturnValue(undefined)

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0)

    expect(result[0].lastLog).toBeNull()
  })

  it('excludes exercises with no routine assignment', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Wednesday' },
    ])

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0) // Monday

    expect(result).toHaveLength(0)
  })

  it('filters by the correct day of week', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
      { id: { value: 2 }, userId: 1, exerciseId: 10, dayOfWeek: 'Monday' },
      { id: { value: 3 }, userId: 1, exerciseId: 15, dayOfWeek: 'Wednesday' },
    ])

    exerciseRepo.findById.mockReturnValueOnce({ id: { value: 5 }, name: 'Bench Press' })
      .mockReturnValueOnce({ id: { value: 10 }, name: 'Squat' })

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0) // Monday

    expect(result).toHaveLength(2)
    expect(result.map(r => r.exerciseId)).toContain(5)
    expect(result.map(r => r.exerciseId)).toContain(10)
  })
})

type StoredLine = {
  id: string
  reps: number
  weight: number
  count?: number
  [stray: string]: unknown
}

const MONDAY = 0
const WEDNESDAY = 2

function todayWithLog(log: unknown, exerciseId = 5) {
  const routineRepo = makeRoutineRepo()
  const workoutRepo = makeWorkoutRepo()
  const exerciseRepo = makeExerciseRepo()

  routineRepo.findAllByUser.mockReturnValue([
    { id: { value: 1 }, userId: 1, exerciseId, dayOfWeek: 'Monday' },
  ])
  exerciseRepo.findById.mockReturnValue({ id: { value: exerciseId }, name: 'Bench Press' })
  workoutRepo.findLatestForExercise.mockReturnValue(log)

  const result = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo).execute(1, MONDAY)
  return { result, routineRepo, workoutRepo, exerciseRepo }
}

function todayWithSets(sets: StoredLine[], exerciseId = 5) {
  return todayWithLog(
    {
      id: 1,
      userId: 1,
      exerciseId,
      date: '2026-11-23',
      sets,
      createdAt: '2026-11-23',
      updatedAt: '2026-11-23',
    },
    exerciseId,
  )
}

describe('lastLog — counted sets', () => {
  it('emits id, weight, reps and count for a counted line', () => {
    const { result } = todayWithSets([{ id: 's1', reps: 5, weight: 135, count: 3 }])

    expect(result).toHaveLength(1)
    expect(result[0].lastLog).toEqual([{ id: 's1', weight: 135, reps: 5, count: 3 }])
  })

  it.each([
    { name: 'a legacy line with no count key', line: { id: 's1', reps: 5, weight: 135 }, expected: undefined },
    { name: 'an explicit count of 1', line: { id: 's1', reps: 5, weight: 135, count: 1 }, expected: 1 },
    { name: 'a fractional count', line: { id: 's1', reps: 5, weight: 135, count: 2.7 }, expected: 2.7 },
    { name: 'a zero count', line: { id: 's1', reps: 5, weight: 135, count: 0 }, expected: 0 },
    { name: 'a negative count', line: { id: 's1', reps: 5, weight: 135, count: -2 }, expected: -2 },
  ])('passes $name through verbatim without throwing', ({ line, expected }) => {
    const run = () => todayWithSets([{ ...line }]).result[0].lastLog![0].count

    expect(run).not.toThrow()
    expect(run()).toBe(expected)
  })

  it('leaves a legacy count undefined rather than defaulting it to 1', () => {
    const { result } = todayWithSets([{ id: 's1', reps: 5, weight: 135 }])

    expect(result[0].lastLog![0].count).toBeUndefined()
    expect(result[0].lastLog![0].count).not.toBe(1)
  })

  it('keeps every stored line in order, each with its own id and count', () => {
    const { result } = todayWithSets([
      { id: 's1', reps: 5, weight: 135, count: 3 },
      { id: 's2', reps: 8, weight: 225, count: 1 },
      { id: 's3', reps: 10, weight: 135 },
    ])

    expect(result[0].lastLog).toEqual([
      { id: 's1', weight: 135, reps: 5, count: 3 },
      { id: 's2', weight: 225, reps: 8, count: 1 },
      { id: 's3', weight: 135, reps: 10, count: undefined },
    ])
  })

  it('does not collapse two lines sharing a weight and reps, nor sum their counts', () => {
    const { result } = todayWithSets([
      { id: 's1', reps: 5, weight: 135, count: 2 },
      { id: 's2', reps: 5, weight: 135, count: 4 },
    ])

    expect(result[0].lastLog).toEqual([
      { id: 's1', weight: 135, reps: 5, count: 2 },
      { id: 's2', weight: 135, reps: 5, count: 4 },
    ])
  })

  it.each([
    { name: 'null', log: null },
    { name: 'undefined', log: undefined },
  ])('returns a null lastLog when the repository answers $name', ({ log }) => {
    const { result } = todayWithLog(log)

    expect(result[0].lastLog).toBeNull()
  })

  it('returns an empty lastLog array when the stored log has no sets', () => {
    const { result } = todayWithSets([])

    expect(result[0].lastLog).toEqual([])
  })

  it('falls back to UNKNOWN and a null lastLog when the exercise is gone', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
    ])
    exerciseRepo.findById.mockReturnValue(undefined)
    workoutRepo.findLatestForExercise.mockReturnValue({
      id: 1,
      sets: [{ id: 's1', reps: 5, weight: 135, count: 3 }],
    })

    const result = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo).execute(1, MONDAY)

    expect(result).toEqual([{ exerciseId: 5, exerciseName: 'UNKNOWN', lastLog: null }])
    expect(workoutRepo.findLatestForExercise).not.toHaveBeenCalled()
  })

  it('still filters by day and carries the widened lastLog on every returned line', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
      { id: { value: 2 }, userId: 1, exerciseId: 10, dayOfWeek: 'Wednesday' },
    ])
    exerciseRepo.findById.mockImplementation((id: number) =>
      id === 5 ? { id: { value: 5 }, name: 'Bench Press' } : { id: { value: 10 }, name: 'Squat' },
    )
    workoutRepo.findLatestForExercise.mockImplementation((_userId: number, exerciseId: number) =>
      exerciseId === 5
        ? { id: 1, sets: [{ id: 's-mon', reps: 5, weight: 135, count: 3 }] }
        : { id: 2, sets: [{ id: 's-wed', reps: 8, weight: 225, count: 2 }] },
    )

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)

    expect(useCase.execute(1, MONDAY)).toEqual([
      { exerciseId: 5, exerciseName: 'Bench Press', lastLog: [{ id: 's-mon', weight: 135, reps: 5, count: 3 }] },
    ])
    expect(useCase.execute(1, WEDNESDAY)).toEqual([
      { exerciseId: 10, exerciseName: 'Squat', lastLog: [{ id: 's-wed', weight: 225, reps: 8, count: 2 }] },
    ])
  })

  it('hands back fresh objects, never the repository set lines', () => {
    const storedLine: StoredLine = { id: 's1', reps: 5, weight: 135, count: 3 }
    const { result, workoutRepo } = todayWithSets([storedLine])

    expect(result[0].lastLog![0]).not.toBe(storedLine)

    result[0].lastLog![0].count = 99

    expect(storedLine.count).toBe(3)
    expect(workoutRepo.findLatestForExercise(1, 5)!.sets[0].count).toBe(3)
  })

  it('emits exactly the four keys and leaks nothing from the stored line', () => {
    const { result } = todayWithSets([
      {
        id: 's1',
        reps: 5,
        weight: 135,
        count: 3,
        setId: 77,
        exerciseId: 5,
        createdAt: '2026-11-23',
      },
    ])

    expect(Object.keys(result[0].lastLog![0]).sort()).toEqual(['count', 'id', 'reps', 'weight'])
  })
})
