import type { WorkoutSet, WorkoutLog } from '@/features/workout/types'

export { WorkoutLog }

export function validateSet(set: WorkoutSet): void {
  if (!Number.isFinite(set.weight) || set.weight <= 0) {
    throw new Error(
      'Weight must be more than 0 — enter the weight you lifted, or remove the line.',
    )
  }

  if (!Number.isFinite(set.reps) || set.reps <= 0) {
    throw new Error(
      'Reps must be more than 0 — enter how many reps you did, or remove the line.',
    )
  }

  if (set.count !== undefined && set.count !== null) {
    if (!Number.isFinite(set.count) || Math.floor(set.count) < 1) {
      throw new Error(
        'Set count must be at least 1 — enter how many sets you did, or leave it blank for one.',
      )
    }
  }
}

/**
 * The shared read rule: a line with no usable count is one set.
 *
 * Total by contract — it never throws. Every reader in the system reaches it
 * through `calculateVolume` or `collapseSets` (both chart doors, the history
 * door, the Today wire, the repo read doors), and not one of those doors has a
 * person standing there to fix a bad row. A stored `count` of `0`, `"3"`, `NaN`
 * or `-1` — any of which an older build, a seed script, or a hand-edited
 * database can leave behind — must therefore read as one set, not take the War
 * Logs page, the Today page and the Force Progression chart down together with
 * a message telling the lifter to "enter how many sets you did" on a screen
 * with no input box.
 *
 * Rejecting an illegal count is the write path's job and belongs there: see
 * `validateSet`, which throws where a lifter can act on the advice. Surfacing a
 * genuinely corrupt stored row is the shell's job, where it can be logged and
 * reported — never this accessor's.
 */
export function getSetCount(line: { count?: number }): number {
  const { count } = line

  // `typeof` rejects a numeric string a hand-edited row can carry (and narrows
  // for the compiler); `Number.isFinite` rejects NaN and both infinities, and
  // answers false for absent, null and every other non-number.
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return 1
  }

  return Math.max(1, Math.floor(count))
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
