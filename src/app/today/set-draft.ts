import type { WorkoutSet } from '@/features/workout/types'

export type SetDraftField = 'weight' | 'reps' | 'count'

export type SetDraft = {
  id: string
  weight: number | null
  reps: number | null
  count: number | null
  raw: Record<SetDraftField, string>
}

export function generateId(): string {
  return crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16)
}

export function createBlankSetDraft(): SetDraft {
  return {
    id: generateId(),
    weight: null,
    reps: null,
    count: null,
    raw: { weight: '', reps: '', count: '' },
  }
}

export function isBlankSetDraft(draft: SetDraft): boolean {
  return (
    draft.weight === null &&
    draft.reps === null &&
    draft.count === null &&
    draft.raw.weight === '' &&
    draft.raw.reps === '' &&
    draft.raw.count === ''
  )
}

export function isCollapsibleSetDraft(draft: SetDraft): boolean {
  return draft.weight !== null && draft.reps !== null
}

export function toWorkoutSet(draft: SetDraft): WorkoutSet {
  if (draft.weight === null) {
    throw new Error('Cannot save a set draft: weight is not a number')
  }
  if (draft.reps === null) {
    throw new Error('Cannot save a set draft: reps is not a number')
  }
  if (draft.count === null) {
    throw new Error('Cannot save a set draft: count is not a number')
  }

  return {
    id: draft.id,
    reps: draft.reps,
    weight: draft.weight,
    count: draft.count,
  }
}
