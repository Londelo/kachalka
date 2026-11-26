import type { WorkoutSet, WorkoutLog } from '@/features/workout/types'

export { WorkoutLog }

export function validateSet(set: WorkoutSet): void {
  if (set.weight < 0) {
    throw new Error('Weight must be non-negative')
  }

  if (set.reps < 1) {
    throw new Error('Reps must be at least 1')
  }
}

export function getSetCount(line: { count?: number }): number {
  if (line.count === undefined || line.count === null) {
    return 1
  }

  if (typeof line.count !== 'number' || !Number.isFinite(line.count)) {
    throw new Error(
      'Set count must be at least 1 - enter how many sets you did, or leave it blank for one.',
    )
  }

  const floored = Math.floor(line.count)

  if (floored < 1) {
    throw new Error(
      'Set count must be at least 1 - enter how many sets you did, or leave it blank for one.',
    )
  }

  return floored
}

export function calculateVolume(sets: { reps: number; weight: number; count?: number }[]): number {
  return sets.reduce((total, line) => total + getSetCount(line) * line.weight * line.reps, 0)
}

export function collapseSets(sets: WorkoutSet[]): WorkoutSet[] {
  const folded = new Map<string, { first: WorkoutSet; count: number }>()

  for (const line of sets) {
    const key = `${line.weight},${line.reps}`
    const seen = folded.get(key)

    if (seen) {
      seen.count += getSetCount(line)
    } else {
      folded.set(key, { first: line, count: getSetCount(line) })
    }
  }

  return [...folded.values()].map(({ first, count }) => ({
    id: first.id,
    reps: first.reps,
    weight: first.weight,
    count,
  }))
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
