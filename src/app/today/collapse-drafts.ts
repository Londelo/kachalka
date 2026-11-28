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
 * Which row speaks for its group is said by id, never by figure: `collapseSets`
 * hands back one row per group wearing the id of the row that opened it.
 * Identity is therefore carried in, never minted — a collapsed row wears the id
 * of the row that survives it, which is what lets the shell's keyed list update
 * that row instead of remounting it.
 */
export function collapseSetDrafts(drafts: SetDraft[]): SetDraft[] {
  const collapsedById = new Map(
    collapseSets(drafts.filter(isNumberedSetDraft).map(toRuleLine)).map((line) => [
      line.id,
      toCollapsedDraft(line),
    ]),
  )

  return drafts.flatMap((draft) => {
    if (!isNumberedSetDraft(draft)) return [draft]

    const collapsed = collapsedById.get(draft.id)
    return collapsed === undefined ? [] : [collapsed]
  })
}
