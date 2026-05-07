'use server'

import { getDatabase } from '@/config/db'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import { createExerciseUseCase } from '@/features/exercise/create-exercise'
import { renameExerciseUseCase } from '@/features/exercise/rename-exercise'
import { deleteExerciseUseCase } from '@/features/exercise/delete-exercise'
import { listExercisesUseCase } from '@/features/exercise/list-exercises'
import type { Exercise } from '@/features/exercise/exercise-entity'

export async function createExerciseAction(name: string, userId: number): Promise<{ success: boolean; exercise?: Exercise; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteExerciseRepository(db)
    const useCase = createExerciseUseCase(repo)
    const exercise = useCase.execute(name, userId)
    return { success: true, exercise }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function renameExerciseAction(exerciseId: number, newName: string, userId: number): Promise<{ success: boolean; exercise?: Exercise; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteExerciseRepository(db)
    const useCase = renameExerciseUseCase(repo)
    const exercise = useCase.execute(exerciseId, newName, userId)
    return { success: true, exercise }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function deleteExerciseAction(exerciseId: number, userId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteExerciseRepository(db)
    const useCase = deleteExerciseUseCase(repo)
    useCase.execute(exerciseId, userId)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function listExercisesAction(): Promise<{ success: boolean; exercises?: Exercise[]; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteExerciseRepository(db)
    const useCase = listExercisesUseCase(repo)
    const exercises = useCase.execute()
    return { success: true, exercises }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}
