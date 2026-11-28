import type { SetDraft } from '@/app/today/set-draft'
import { generateId, isCollapsibleSetDraft } from '@/app/today/set-draft'
import type { WorkoutSet } from '@/features/workout/types'
import { collapseSets, getSetCount } from '@/features/workout/workout-entity'

type NumberedSetDraft = SetDraft & { weight: number; reps: number }

function isNumberedSetDraft(draft: SetDraft): draft is NumberedSetDraft {
  return isCollapsibleSetDraft(draft)
}

function toRuleLine(draft: NumberedSetDraft): WorkoutSet {
  const line = { id: draft.id, reps: draft.reps, weight: draft.weight }
  return draft.count === null ? line : { ...line, count: draft.count }
}

function toCollapsedDraft(line: WorkoutSet): SetDraft {
  const count = getSetCount(line)

  return {
    id: generateId(),
    weight: line.weight,
    reps: line.reps,
    count,
    raw: {
      weight: String(line.weight),
      reps: String(line.reps),
      count: String(count),
    },
  }
}

/**
 * Puts the shared collapse rule's answer back on screen while the lifter is
 * still typing, so two rows describing the same work become one row whose
 * count is the sum.
 *
 * Grouping and summing belong to `collapseSets` alone. This function performs
 * no arithmetic on counts and never supplies a count of its own: a draft with
 * a blank count is handed over with the `count` key omitted entirely, so the
 * domain's own "no count means one set" default is what produces the one.
 *
 * Nothing is dropped. Rows the rule cannot take — no weight, or no reps — are
 * returned untouched after the collapsed ones, in their original order.
 */
export function collapseSetDrafts(drafts: SetDraft[]): SetDraft[] {
  const numbered = drafts.filter(isNumberedSetDraft)
  const untouched = drafts.filter((draft) => !isNumberedSetDraft(draft))

  const collapsed = collapseSets(numbered.map(toRuleLine)).map(toCollapsedDraft)

  return [...collapsed, ...untouched]
}
