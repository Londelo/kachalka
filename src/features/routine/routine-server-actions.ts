'use server'

import { getDatabase } from '@/config/db'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import { assignExerciseUseCase } from '@/features/routine/assign-exercise'
import { removeExerciseUseCase } from '@/features/routine/remove-exercise'
import { getUserRoutineUseCase } from '@/features/routine/get-user-routine'
import type { RoutineAssignment } from '@/features/routine/routine-entity'
import type { DayOfWeek } from '@/features/routine/routine-entity'

export async function assignExerciseAction(
  userId: number,
  exerciseId: number,
  dayOfWeek: DayOfWeek,
): Promise<{ success: boolean; assignment?: RoutineAssignment; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteRoutineRepository(db)
    const useCase = assignExerciseUseCase(repo)
    const assignment = useCase.execute(userId, exerciseId, dayOfWeek)
    return { success: true, assignment }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function removeAssignmentAction(
  userId: number,
  assignmentId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteRoutineRepository(db)
    const useCase = removeExerciseUseCase(repo)
    useCase.execute(userId, assignmentId)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export async function getUserRoutineAction(
  userId: number,
): Promise<{ success: boolean; routine?: Record<string, RoutineAssignment[]>; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteRoutineRepository(db)
    const useCase = getUserRoutineUseCase(repo)
    const routine = useCase.execute(userId)
    return { success: true, routine }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}
