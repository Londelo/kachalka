import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { validateSet } from '@/features/workout/workout-entity'

export function updateWorkoutUseCase(repo: WorkoutRepository) {
  return {
    execute(logId: number, userId: number, sets: WorkoutSet[]): WorkoutLog {
      const log = repo.findById(logId)

      if (!log) {
        throw new Error('Workout log not found')
      }

      if (log.userId !== userId) {
        throw new Error('Only the owner can update this workout log')
      }

      for (const set of sets) {
        validateSet(set)
      }

      const updated = repo.update(logId, sets)

      if (!updated) {
        throw new Error('Workout log not found')
      }

      return updated
    },
  }
}
