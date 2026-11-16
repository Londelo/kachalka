import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'

/**
 * The wire shape for one day of training: every set line logged on `date`,
 * keyed by exercise id. A line carries exactly the three fields Today's Battle
 * renders — count, reps, weight — and nothing else from the stored row.
 */
export type TodayWorkouts = Record<number, { weight: number; reps: number; count: number }[]>

/**
 * Field selection only.
 *
 * The repository read path is the single owner of the set-count rule and has
 * already decoded every line to a number >= 1, so this projection re-enforces
 * nothing — which is exactly why it cannot be the thing that throws on a
 * corrupt stored byte.
 */
const toWireSet = (set: WorkoutSet) => ({
  weight: set.weight,
  reps: set.reps,
  count: set.count!,
})

const toWireLines = (log: WorkoutLog) => log.sets.map(toWireSet)

export function getTodayWorkoutsUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number, date: string): TodayWorkouts {
      return repo.findByDate(userId, date).reduce<TodayWorkouts>(
        (workouts, log) => ({ ...workouts, [log.exerciseId]: toWireLines(log) }),
        {},
      )
    },
  }
}
