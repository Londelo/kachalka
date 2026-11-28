import type { WorkoutSet } from '@/features/workout/types'
import {
  calculateRepTotal,
  calculateSetCount,
  calculateVolume,
} from '@/features/workout/workout-entity'

export type ExerciseMetrics = {
  name: string
  totalSets: number
  totalReps: number
  totalVolume: number
  maxWeight: number
}

export const countTotalSets: (sets: WorkoutSet[]) => number = calculateSetCount

export const countTotalReps: (sets: WorkoutSet[]) => number = calculateRepTotal

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
