import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { collapseDuplicateSets, normalizeSetLines, createEmptyLog } from '@/features/workout/workout-entity'

/**
 * The write path for one exercise's sets on one date: the domain rules first,
 * the repository last, and nothing else.
 *
 * This use case validates nothing of its own. What a set line means — weight,
 * reps, and the whole-number count rule — is owned by
 * src/features/workout/workout-entity.ts and throws from there, and the fold is
 * owned by `collapseDuplicateSets`. Sequencing those two over the array the
 * domain handed back is the whole job; a guard restated here would be a second
 * owner of a rule that already has one, free to disagree with it.
 */
export function logWorkoutUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number, exerciseId: number, date: string, sets: WorkoutSet[]): WorkoutLog {
      if (sets.length === 0) {
        throw new Error('Must log at least one set')
      }

      const canonicalSets = normalizeSetLines(sets)
      const collapsed = collapseDuplicateSets(canonicalSets)

      const existing = repo.findByDateAndExercise(userId, date, exerciseId)

      if (existing) {
        return repo.update(existing.id, collapsed)!
      }

      const unsaved = createEmptyLog(userId, exerciseId, date)
      return repo.create({ ...unsaved, sets: collapsed })
    },
  }
}
