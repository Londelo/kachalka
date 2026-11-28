import { describe, it, expect } from 'vitest'
import {
  describeIncompleteDraftFields,
  selectSaveableDrafts,
} from '@/app/today/saveable-sets'
import { createBlankSetDraft } from '@/app/today/set-draft'
import type { SetDraft, SetDraftField } from '@/app/today/set-draft'

const draft = (
  numbers: Partial<Record<SetDraftField, number | null>> = {},
  raw: Partial<Record<SetDraftField, string>> = {},
): SetDraft => ({
  ...createBlankSetDraft(),
  ...numbers,
  raw: { weight: '', reps: '', count: '', ...raw },
})

const completeDraft = (): SetDraft =>
  draft({ weight: 135, reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' })

const draftWithField = (
  field: SetDraftField,
  value: number | null,
  text: string,
): SetDraft => {
  const base = completeDraft()
  return { ...base, [field]: value, raw: { ...base.raw, [field]: text } }
}

const BLANK: SetDraft = draft()
const BLANK_AGAIN: SetDraft = draft()
const COMPLETE: SetDraft = completeDraft()
const HALF_FILLED: SetDraft = draft({ reps: 5 }, { reps: '5' })
const ZERO_REPS: SetDraft = draft(
  { weight: 135, reps: 0, count: 1 },
  { weight: '135', reps: '0', count: '1' },
)
const COUNT_ONLY: SetDraft = draft(
  { weight: 0, reps: 0, count: 3 },
  { weight: '0', reps: '0', count: '3' },
)
const JUNK_WEIGHT: SetDraft = draft(
  { weight: null, reps: 5, count: 1 },
  { weight: 'heavy', reps: '5', count: '1' },
)
const TEXT_ONLY: SetDraft = draft({}, { weight: ' ' })

describe('selectSaveableDrafts', () => {
  it('returns an empty array when there are no drafts at all', () => {
    expect(selectSaveableDrafts([])).toEqual([])
  })

  it('drops every row when every row is untouched in all three fields', () => {
    expect(selectSaveableDrafts([BLANK, BLANK_AGAIN])).toEqual([])
  })

  it.each([
    { name: 'a fully numbered row', row: COMPLETE },
    { name: 'a row whose reps is a real zero', row: ZERO_REPS },
    { name: 'a row filled with nothing but a count', row: COUNT_ONLY },
    { name: 'a half-filled row', row: HALF_FILLED },
    { name: 'a row whose weight text cannot be parsed', row: JUNK_WEIGHT },
    { name: 'a row with typed text and no numbers at all', row: TEXT_ONLY },
  ])('keeps $name so the lifter is told what is wrong about it', ({ row }) => {
    const result = selectSaveableDrafts([row])

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(row)
  })

  it('keeps the untouched row out and every other row in on-screen order', () => {
    const result = selectSaveableDrafts([
      BLANK,
      COMPLETE,
      BLANK_AGAIN,
      HALF_FILLED,
      JUNK_WEIGHT,
    ])

    expect(result).toHaveLength(3)
    expect(result[0]).toBe(COMPLETE)
    expect(result[1]).toBe(HALF_FILLED)
    expect(result[2]).toBe(JUNK_WEIGHT)
  })

  it('returns all three rows when none of them is blank, in the same order', () => {
    const first = completeDraft()
    const second = completeDraft()
    const third = completeDraft()

    const result = selectSaveableDrafts([first, second, third])

    expect(result).toEqual([first, second, third])
    expect(result[0]).toBe(first)
    expect(result[1]).toBe(second)
    expect(result[2]).toBe(third)
  })

  it('never mutates the input array or the drafts inside it', () => {
    const input = [BLANK, COMPLETE, HALF_FILLED]
    const snapshot = JSON.parse(JSON.stringify(input))

    const result = selectSaveableDrafts(input)

    expect(input).toHaveLength(3)
    expect(input[0]).toBe(BLANK)
    expect(input[1]).toBe(COMPLETE)
    expect(input[2]).toBe(HALF_FILLED)
    expect(input).toEqual(snapshot)
    expect(result).not.toBe(input)
    expect(result).toEqual([COMPLETE, HALF_FILLED])
  })
})

describe('describeIncompleteDraftFields', () => {
  it('reports nothing for a fully numbered draft', () => {
    expect(describeIncompleteDraftFields(COMPLETE)).toEqual([])
  })

  it('reports nothing when every number is a real zero, because legality is the domain to decide', () => {
    const zeros = draft({ weight: 0, reps: 0, count: 0 }, { weight: '0', reps: '0', count: '0' })

    expect(describeIncompleteDraftFields(zeros)).toEqual([])
  })

  it('reports nothing for a field whose number is present even when its raw text is junk', () => {
    const contradictory = draft(
      { weight: 135, reps: 5, count: 3 },
      { weight: 'junk', reps: '', count: '   ' },
    )

    expect(describeIncompleteDraftFields(contradictory)).toEqual([])
  })

  it('reports all three fields as blank for an untouched draft, in the order weight, reps, count', () => {
    expect(describeIncompleteDraftFields(BLANK)).toEqual([
      { field: 'weight', reason: 'blank', raw: '' },
      { field: 'reps', reason: 'blank', raw: '' },
      { field: 'count', reason: 'blank', raw: '' },
    ])
  })

  it.each([
    { field: 'weight' as const, junk: 'heavy' },
    { field: 'reps' as const, junk: 'fast' },
    { field: 'count' as const, junk: 'x' },
  ])('reports only $field as invalid, carrying its own raw text', ({ field, junk }) => {
    const result = describeIncompleteDraftFields(draftWithField(field, null, junk))

    expect(result).toEqual([{ field, reason: 'invalid', raw: junk }])
  })

  it.each([{ field: 'weight' as const }, { field: 'reps' as const }, { field: 'count' as const }])(
    'reports only $field as blank when its text was never touched',
    ({ field }) => {
      const result = describeIncompleteDraftFields(draftWithField(field, null, ''))

      expect(result).toEqual([{ field, reason: 'blank', raw: '' }])
    },
  )

  it('reports every offending field in the fixed order weight, reps, count regardless of which are missing', () => {
    const messy = draft(
      { weight: null, reps: null, count: null },
      { weight: 'heavy', reps: '', count: 'x' },
    )

    expect(describeIncompleteDraftFields(messy)).toEqual([
      { field: 'weight', reason: 'invalid', raw: 'heavy' },
      { field: 'reps', reason: 'blank', raw: '' },
      { field: 'count', reason: 'invalid', raw: 'x' },
    ])
  })

  it('skips the complete weight and reports reps blank then count invalid', () => {
    const partial = draft(
      { weight: 135, reps: null, count: null },
      { weight: '135', reps: '', count: 'x' },
    )

    expect(describeIncompleteDraftFields(partial)).toEqual([
      { field: 'reps', reason: 'blank', raw: '' },
      { field: 'count', reason: 'invalid', raw: 'x' },
    ])
  })

  it('treats a single space as text, not blank', () => {
    const whitespace = draft(
      { weight: null, reps: null, count: 2 },
      { weight: ' ', reps: '', count: '2' },
    )

    expect(describeIncompleteDraftFields(whitespace)).toEqual([
      { field: 'weight', reason: 'invalid', raw: ' ' },
      { field: 'reps', reason: 'blank', raw: '' },
    ])
  })
})
