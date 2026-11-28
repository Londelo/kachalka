import type { WorkoutSet, WorkoutLog } from '@/features/workout/types'

export { WorkoutLog }

/**
 * The one authored sentence behind the rule "a count must be at least 1".
 *
 * Every place that enforces or reports that rule reads it from here, so a
 * lifter never sees two spellings of one instruction. The em dash matches the
 * weight and reps messages below — the punctuation is part of the message the
 * user acts on, not decoration.
 */
export const COUNT_TOO_SMALL =
  'Set count must be at least 1 — enter how many sets you did, or leave it blank for one.'

/**
 * The write path's judge: throws, because a lifter is standing at an input box
 * and can act on the advice.
 *
 * `lineNumber` is the 1-based position of the line being judged, and the caller
 * that walks a card's lines owns it — a card renders one error string for the
 * whole exercise, so without the position a refusal on a multi-line card names
 * the field and leaves the lifter to guess which line to fix. Absent it, the
 * message is the bare sentence, which is the whole of the message where no line
 * is in question.
 */
export function validateSet(set: WorkoutSet, lineNumber?: number): void {
  const where = lineNumber === undefined ? '' : `Line ${lineNumber}: `

  if (!Number.isFinite(set.weight) || set.weight <= 0) {
    throw new Error(
      `${where}Weight must be more than 0 — enter the weight you lifted, or remove the line.`,
    )
  }

  if (!Number.isFinite(set.reps) || set.reps < 1) {
    throw new Error(
      `${where}Reps must be at least 1 — enter how many reps you did, or remove the line.`,
    )
  }

  if (set.count !== undefined && set.count !== null) {
    if (!Number.isFinite(set.count) || Math.floor(set.count) < 1) {
      throw new Error(`${where}${COUNT_TOO_SMALL}`)
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

export function calculateSetCount(sets: { count?: number }[]): number {
  return sets.reduce((total, line) => total + getSetCount(line), 0)
}

export function calculateRepTotal(sets: { reps: number; count?: number }[]): number {
  return sets.reduce((total, line) => total + getSetCount(line) * line.reps, 0)
}

/**
 * The three figures the fold is defined over, and nothing else.
 *
 * A stored line is a `WorkoutSet` and carries an `id`; a line read out for a
 * read-only view may carry no `id` at all. Both are the same work to the fold,
 * so the fold is typed against this subset and each entry point below decides
 * what its own callers get back.
 */
export type CollapsibleSet = {
  weight: number
  reps: number
  count?: number
}

/** A folded line: the figures of the first line of its group, count summed. */
export type CollapsedSet = {
  weight: number
  reps: number
  count: number
}

/**
 * The fold itself, shared by both entry points below so there is exactly one
 * spelling of it: one line per distinct `weight,reps` pair, in order of first
 * appearance, its count the sum of every matching line's `getSetCount`.
 *
 * It groups and sums and judges nothing — `validateSet` is the write path's
 * judge — and it hands back the surviving line by reference inside its own
 * freshly built wrapper, so the lines it was handed are never touched.
 */
function foldByWork<T extends CollapsibleSet>(sets: T[]): Array<{ first: T; count: number }> {
  const folded = new Map<string, { first: T; count: number }>()

  for (const line of sets) {
    const key = `${line.weight},${line.reps}`
    const seen = folded.get(key)

    if (seen) {
      seen.count += getSetCount(line)
    } else {
      folded.set(key, { first: line, count: getSetCount(line) })
    }
  }

  return [...folded.values()]
}

/**
 * Stored lines in, stored lines out: each folded line wears the id of the line
 * that survived its group, which is what lets a keyed list update that row
 * instead of remounting it.
 */
export function collapseSets(sets: WorkoutSet[]): WorkoutSet[] {
  return foldByWork(sets).map(({ first, count }) => ({
    id: first.id,
    reps: first.reps,
    weight: first.weight,
    count,
  }))
}

/**
 * The same fold for lines that never had an id — a read-only view's rows, say.
 *
 * Nothing here invents one and nothing here asks for one: the caller gets the
 * three figures and the summed count, which is the whole of what a view with no
 * save path can render.
 */
export function collapseSetFigures(sets: CollapsibleSet[]): CollapsedSet[] {
  return foldByWork(sets).map(({ first, count }) => ({
    weight: first.weight,
    reps: first.reps,
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
