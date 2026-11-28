import type { WorkoutSet } from '@/features/workout/types'
import { calculateVolume, getSetCount } from '@/features/workout/workout-entity'

export type ExerciseMetrics = {
  name: string
  totalSets: number
  totalReps: number
  totalVolume: number
  maxWeight: number
}

export function countTotalSets(sets: WorkoutSet[]): number {
  return sets.reduce((total, line) => total + getSetCount(line), 0)
}

export function countTotalReps(sets: WorkoutSet[]): number {
  return sets.reduce((total, line) => total + getSetCount(line) * line.reps, 0)
}

export function calcExerciseMetrics(
  exercises: { name: string; sets: WorkoutSet[] }[],
): ExerciseMetrics[] {
  return exercises.map((exercise) => ({
    name: exercise.name,
    totalSets: countTotalSets(exercise.sets),
    totalReps: countTotalReps(exercise.sets),
    totalVolume: calculateVolume(exercise.sets),
    maxWeight: exercise.sets.length > 0 ? Math.max(...exercise.sets.map((line) => line.weight)) : 0,
  }))
}
