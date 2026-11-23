import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { normalizeSetLines, createEmptyLog } from '@/features/workout/workout-entity'

/**
 * The write path for one exercise's sets on one date: the domain rules first,
 * the repository last, and nothing else.
 *
 * This use case enforces nothing of its own. What a set line means — weight,
 * reps, the whole-number count rule, and the fold of same-weight-same-reps
 * lines into one — is owned by src/features/workout/workout-entity.ts, and all
 * of it arrives through the one call to `normalizeSetLines`. Handing the
 * repository anything else, or applying `collapseDuplicateSets` here as a
 * second step, would put a copy of the canonical form in this file: a fact that
 * can disagree with the module that owns it. Sequencing the two rules by hand
 * at each call site is how a writer came to store an unfolded row in the first
 * place: that writer remembered one of the two and not the other.
 */
export function logWorkoutUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number, exerciseId: number, date: string, sets: WorkoutSet[]): WorkoutLog {
      if (sets.length === 0) {
        throw new Error('Must log at least one set')
      }

      const canonicalSets = normalizeSetLines(sets)

      const existing = repo.findByDateAndExercise(userId, date, exerciseId)

      if (existing) {
        return repo.update(existing.id, canonicalSets)!
      }

      const unsaved = createEmptyLog(userId, exerciseId, date)
      return repo.create({ ...unsaved, sets: canonicalSets })
    },
  }
}
