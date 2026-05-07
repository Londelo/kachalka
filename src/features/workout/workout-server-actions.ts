'use server'

import { getDatabase } from '@/config/db'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
import { updateWorkoutUseCase } from '@/features/workout/update-workout'
import { deleteWorkoutUseCase } from '@/features/workout/delete-workout'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'

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

export async function updateWorkoutAction(
  logId: number,
  userId: number,
  sets: WorkoutSet[],
): Promise<{ success: boolean; log?: WorkoutLog; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const useCase = updateWorkoutUseCase(repo)
    const log = useCase.execute(logId, userId, sets)
    return { success: true, log }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function deleteWorkoutAction(
  logId: number,
  userId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const useCase = deleteWorkoutUseCase(repo)
    useCase.execute(logId, userId)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

type ExerciseInfo = {
  exerciseId: number
  exerciseName: string
  lastLog: { weight: number; reps: number }[] | null
}

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
