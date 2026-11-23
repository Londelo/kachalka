import type { WorkoutSet, WorkoutLog } from '@/features/workout/types'

export { WorkoutLog }

/**
 * Inbound normalizer — the single enforcement point of the set-count rule.
 *
 * Write path only, and the whole rule lives in these ten lines: blank, absent
 * and zero all mean one set, and anything else has to already be a whole number
 * of sets. Non-numeric, non-finite, negative and fractional counts are all
 * refused, with the one message, rather than silently corrected — a line
 * claiming 2.7 sets is not a count that got rounded wrong, it is a line nobody
 * meant, and flooring it would hand the commander a number he never typed.
 *
 * `Number.isInteger` is the whole test: it refuses NaN and Infinity along with
 * every fraction, so no second guard is needed beside it. Every writer reaches
 * this through `normalizeSetLines` and stores what comes back; nobody restates
 * any half of it downstream. `decodeSetCount` is the read-side counterpart and
 * deliberately not this function's mirror — it coerces, this one refuses.
 */
export function normalizeSetCount(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return 1
  }

  const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN

  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Set count must be at least 1')
  }

  return Math.max(1, value)
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
 * projection onto exactly the fields the type claims, count resolved by
 * `normalizeSetCount` — so a writer can store what the domain handed back
 * instead of re-deriving the rule a second time.
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
 * the count rule but forget the projection, or the reverse. One owner per
 * direction is what keeps two writers from disagreeing on the same logical line.
 */
export function normalizeSetLines(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((set) => validateSet(set))
}

export function calculateVolume(sets: { reps: number; weight: number }[]): number {
  return sets.reduce((total, set) => total + set.reps * set.weight, 0)
}

/**
 * The collapse rule — the one implementation in the codebase of "same weight
 * plus same reps is the same line". Every line carrying an equal pair becomes
 * a single line whose count is the sum of all their counts, in the order each
 * pair was first seen.
 *
 * Position is not meaningful to the rule, but the output is deterministic all
 * the same: the surviving line keeps the first matching line's id so React can
 * key on it, and neither the input array nor any line inside it is touched.
 *
 * Count is resolved before it is summed, and deliberately not through
 * `decodeSetCount`: that one floors, and a line claiming 2.5 sets is not a
 * fractional group of sets, it is a line nobody meant, so it contributes
 * exactly 1 like a blank one does rather than a suspect 2.
 */
export function collapseDuplicateSets(sets: WorkoutSet[]): WorkoutSet[] {
  const groups = sets.reduce<Map<string, WorkoutSet>>((byPair, set) => {
    const key = `${set.weight}|${set.reps}`
    const claimed = set.count
    const count = typeof claimed === 'number' && Number.isInteger(claimed) && claimed >= 1 ? claimed : 1
    const existing = byPair.get(key)

    byPair.set(
      key,
      existing
        ? { ...existing, count: (existing.count ?? 0) + count }
        : { id: set.id, weight: set.weight, reps: set.reps, count },
    )

    return byPair
  }, new Map())

  return [...groups.values()]
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
