import type { WorkoutSet } from '@/features/workout/types'

export type WorkoutLog = {
  id: { value: number }
  userId: number
  exerciseId: number
  date: string
  sets: WorkoutSet[]
  createdAt: string
  updatedAt: string
}

export function validateSet(set: WorkoutSet): void {
  if (set.weight <= 0) {
    throw new Error('Weight must be greater than 0')
  }

  if (set.reps < 1) {
    throw new Error('Reps must be at least 1')
  }

  if (set.rpe < 1 || set.rpe > 10) {
    throw new Error('RPE must be between 1 and 10')
  }

  if (set.rest < 0) {
    throw new Error('Rest must be non-negative')
  }
}

export function calculateVolume(sets: { reps: number; weight: number }[]): number {
  return sets.reduce((total, set) => total + set.reps * set.weight, 0)
}

export function createEmptyLog(
  userId: number,
  exerciseId: number,
  date: string,
): Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId,
    exerciseId,
    date,
    sets: [],
  }
}
