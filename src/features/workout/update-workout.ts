import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { normalizeSetLines } from '@/features/workout/workout-entity'

/**
 * The second writer to the `sets` column — same canonical form as the first,
 * because both reach it through the one call to `normalizeSetLines`, which
 * projects, count-checks and folds. Nothing here restates any of that: a fold
 * written at this call site would be a second owner of the rule, free to be
 * forgotten the way a fold written only in log-workout.ts once was.
 */
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

      const canonicalSets = normalizeSetLines(sets)

      const updated = repo.update(logId, canonicalSets)

      if (!updated) {
        throw new Error('Workout log not found')
      }

      return updated
    },
  }
}
