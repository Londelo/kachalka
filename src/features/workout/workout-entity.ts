import type { WorkoutSet, WorkoutLog } from '@/features/workout/types'

export { WorkoutLog }

/**
 * Inbound normalizer — the single enforcement point of the set-count floor rule.
 *
 * Write path only. Blank, absent and zero all mean one set; anything genuinely
 * below 1 or non-numeric is rejected rather than silently corrected, so the
 * commander is told instead of quietly rewritten.
 */
export function normalizeSetCount(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return 1
  }

  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Set count must be at least 1')
  }

  return Math.max(1, Math.floor(value))
}

/**
 * Outbound decoder — read path only, and it never throws.
 *
 * A stored line whose count is missing or corrupt is read as exactly one set.
 * Coercion, not policing: a bad byte already on disk is a data problem, not a
 * validation event, and must not take down every read of the row.
 */
export function decodeSetCount(raw: unknown): number {
  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN
  const floored = Math.floor(value)

  return Number.isFinite(floored) ? Math.max(1, floored) : 1
}

/**
 * Domain check for one incoming set line. Returns the canonical line — weight
 * and reps as given, count normalised to the floor — so a writer can store what
 * the domain handed back instead of re-deriving the rule a second time.
 */
export function validateSet(set: WorkoutSet): WorkoutSet {
  if (set.weight < 0) {
    throw new Error('Weight must be non-negative')
  }

  if (set.reps < 1) {
    throw new Error('Reps must be at least 1')
  }

  return { ...set, count: normalizeSetCount(set.count) }
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
