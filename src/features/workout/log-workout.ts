import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { normalizeSetLines, createEmptyLog } from '@/features/workout/workout-entity'

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
