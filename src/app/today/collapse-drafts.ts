import type { SetDraft } from '@/app/today/set-draft'
import { isCollapsibleSetDraft } from '@/app/today/set-draft'
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
    id: line.id,
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
 * Nothing is dropped and nothing moves. Every position of the card is answered
 * exactly once, in the order the lifter arranged it: the row that opens a group
 * answers with that group's collapsed row, a later row of the same group
 * answers with nothing because its group has already spoken, and a row the rule
 * cannot take — no weight, no reps, or a count the domain would refuse —
 * answers with itself, still holding the count that was typed. A refused row
 * therefore stays under the caret instead of sliding to the bottom of the card
 * mid-word.
 *
 * The answer arrives as one row per group in order of the group's first
 * appearance, so the group a row opens is always the next answer unread, and
 * reading the two lists side by side is what lines each collapsed row up with
 * the position its group began at.
 *
 * Identity is carried in, never minted: `collapseSets` hands back the first
 * line of each group, so a collapsed row wears the id the row that survives
 * went in with, and the shell's keyed list updates it instead of remounting it.
 */
export function collapseSetDrafts(drafts: SetDraft[]): SetDraft[] {
  const groups = collapseSets(drafts.filter(isNumberedSetDraft).map(toRuleLine))
  const positioned: SetDraft[] = []

  let nextGroup = 0

  for (const draft of drafts) {
    if (!isNumberedSetDraft(draft)) {
      positioned.push(draft)
      continue
    }

    const group = groups[nextGroup]

    if (group && group.weight === draft.weight && group.reps === draft.reps) {
      nextGroup += 1
      positioned.push(toCollapsedDraft(group))
    }
  }

  return positioned
}
