import type { SetDraft, SetDraftField } from '@/app/today/set-draft'
import { isBlankSetDraft } from '@/app/today/set-draft'

export type IncompleteField = {
  field: SetDraftField
  reason: 'blank' | 'invalid'
  raw: string
}

const FIELD_ORDER: readonly SetDraftField[] = ['weight', 'reps', 'count']

export function selectSaveableDrafts(drafts: SetDraft[]): SetDraft[] {
  return drafts.filter((draft) => !isBlankSetDraft(draft))
}

export function describeIncompleteDraftFields(draft: SetDraft): IncompleteField[] {
  const incomplete: IncompleteField[] = []

  for (const field of FIELD_ORDER) {
    if (draft[field] !== null) continue

    const raw = draft.raw[field]
    incomplete.push(
      raw === '' ? { field, reason: 'blank', raw: '' } : { field, reason: 'invalid', raw },
    )
  }

  return incomplete
}
