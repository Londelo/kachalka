'use server'

import { getDatabase } from '@/config/db'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import { getWorkoutHistoryUseCase } from '@/features/workout/get-workout-history'
import { getUserVolumeUseCase } from '@/features/workout/get-user-volume'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { getTodayLocalDate } from '@/shared/utils/date'

export async function logWorkoutAction(
  userId: number,
  exerciseId: number,
  date: string,
  sets: WorkoutSet[],
): Promise<{ success: boolean; log?: WorkoutLog; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const useCase = logWorkoutUseCase(repo)
    const log = useCase.execute(userId, exerciseId, date, sets)
    return { success: true, log }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

type ExerciseInfo = {
  exerciseId: number
  exerciseName: string
  lastLog: { id: string; weight: number; reps: number; count?: number }[] | null
}

export type TodayWorkouts = Record<
  number,
  { id: string; weight: number; reps: number; count?: number }[]
>

export async function getTodayExercisesAction(
  userId: number,
  dayOfWeek: number,
): Promise<{ success: boolean; exercises?: ExerciseInfo[] | null; error?: string }> {
  try {
    const db = getDatabase()
    const workoutRepo = createSqliteWorkoutRepository(db)
    const routineRepo = createSqliteRoutineRepository(db)
    const exerciseRepo = createSqliteExerciseRepository(db)
    const useCase = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo)
    const exercises = useCase.execute(userId, dayOfWeek)
    return { success: true, exercises }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message, exercises: null }
  }
}

type HistoryEntry = {
  date: string
  logs: {
    id: number
    exerciseId: number
    exerciseName: string
    sets: WorkoutSet[]
    volume: number
  }[]
}

export async function getTodayWorkoutsAction(
  userId: number,
): Promise<{ success: boolean; workouts?: TodayWorkouts | null; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const today = getTodayLocalDate()
    const logs = repo.findByDate(userId, today)
    const workouts: TodayWorkouts = {}
    for (const log of logs) {
      workouts[log.exerciseId] = log.sets.map(s => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        count: s.count,
      }))
    }
    return { success: true, workouts }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message, workouts: null }
  }
}

export async function getHistoryAction(
  userId: number,
): Promise<{ success: boolean; history?: HistoryEntry[]; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const useCase = getWorkoutHistoryUseCase(repo)
    const history = useCase.execute(userId)
    return { success: true, history }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

