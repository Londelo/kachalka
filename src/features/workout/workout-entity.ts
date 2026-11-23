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
 * Domain check for one incoming set line. Returns the canonical line — a
 * projection onto exactly the fields the type claims, count normalised to the
 * floor — so a writer can store what the domain handed back instead of
 * re-deriving the rule a second time.
 *
 * This is a projection, not a spread. `sets` arrives from a `'use server'`
 * entry point, so the incoming object may carry keys nobody in this codebase
 * invented. Spreading would persist them verbatim into the `sets` column and
 * hand them back out through every read path; picking the four known fields is
 * what makes "the stored shape is the shape the type claims" actually true.
 */
export function validateSet(set: WorkoutSet): WorkoutSet {
  if (set.weight < 0) {
    throw new Error('Weight must be non-negative')
  }

  if (set.reps < 1) {
    throw new Error('Reps must be at least 1')
  }

  return {
    id: set.id,
    reps: set.reps,
    weight: set.weight,
    count: normalizeSetCount(set.count),
  }
}

/**
 * Inbound projection of a whole set array — the single write-side enforcement
 * point for what reaches the `sets` column.
 *
 * Every writer calls this and stores what it returns, so no writer can apply
 * the floor rule but forget the projection, or the reverse. One owner per
 * direction is what keeps two writers from disagreeing on the same logical line.
 */
export function normalizeSetLines(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((set) => validateSet(set))
}

export function calculateVolume(sets: { reps: number; weight: number; count?: number }[]): number {
  return sets.reduce((total, set) => total + decodeSetCount(set.count) * set.reps * set.weight, 0)
}

export function countSets(sets: { count?: number }[]): number {
  return sets.reduce((total, set) => total + decodeSetCount(set.count), 0)
}

export function countReps(sets: { reps: number; count?: number }[]): number {
  return sets.reduce((total, set) => total + set.reps * decodeSetCount(set.count), 0)
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
