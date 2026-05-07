import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

function makeWorkoutRepo(overrides: Partial<WorkoutRepository> = {}): WorkoutRepository {
  return {
    findById: vi.fn(),
    create: vi.fn(),
    findByDateAndExercise: vi.fn(),
    findByDate: vi.fn(),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByDayOfWeek: vi.fn(),
    ...overrides,
  }
}

function makeRoutineRepo(overrides: Partial<RoutineRepository> = {}): RoutineRepository {
  return {
    findById: vi.fn(),
    findByUserAndDay: vi.fn(),
    findAllByUser: vi.fn(),
    findAllByUserGroupedByDay: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    exerciseExists: vi.fn(),
    ...overrides,
  }
}

function makeExerciseRepo(overrides: Partial<ExerciseRepository> = {}): ExerciseRepository {
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
  }
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

  it('includes lastLog for each exercise', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
    ])

    exerciseRepo.findById.mockReturnValue({ id: { value: 5 }, name: 'Bench Press' })
    workoutRepo.findByDateAndExercise.mockReturnValue({
      sets: [{ weight: 225, reps: 10, rpe: 8, rest: 60 }],
    })

    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const result = useCase.execute(1, 0)

    expect(result[0].lastLog).toEqual({ weight: 225, reps: 10 })
  })

  it('returns null lastLog when no previous workout', () => {
    const routineRepo = makeRoutineRepo()
    const workoutRepo = makeWorkoutRepo()
    const exerciseRepo = makeExerciseRepo()

    routineRepo.findAllByUser.mockReturnValue([
      { id: { value: 1 }, userId: 1, exerciseId: 5, dayOfWeek: 'Monday' },
    ])

    exerciseRepo.findById.mockReturnValue({ id: { value: 5 }, name: 'Bench Press' })
    workoutRepo.findByDateAndExercise.mockReturnValue(undefined)

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
