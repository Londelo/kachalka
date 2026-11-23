import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { collapseDuplicateSets, normalizeSetLines, createEmptyLog } from '@/features/workout/workout-entity'

function assertWholeSetCount(count: unknown): void {
  if (count === undefined || count === null || count === '') {
    return
  }

  const value = typeof count === 'number' || typeof count === 'string' ? Number(count) : NaN

  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Set count must be a whole number of at least 1')
  }
}

export function logWorkoutUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number, exerciseId: number, date: string, sets: WorkoutSet[]): WorkoutLog {
      if (sets.length === 0) {
        throw new Error('Must log at least one set')
      }

      const canonicalSets = normalizeSetLines(sets)

      sets.forEach((set) => assertWholeSetCount(set.count))

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
