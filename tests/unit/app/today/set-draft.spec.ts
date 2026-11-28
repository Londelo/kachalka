import { describe, it, expect } from 'vitest'
import {
  createBlankSetDraft,
  generateId,
  isBlankSetDraft,
  isCollapsibleSetDraft,
  toWorkoutSet,
} from '@/app/today/set-draft'
import type { SetDraft, SetDraftField } from '@/app/today/set-draft'

const BLANK_DRAFT: SetDraft = {
  id: 'draft-1',
  weight: null,
  reps: null,
  count: null,
  raw: { weight: '', reps: '', count: '' },
}

const draftWith = (
  numbers: Partial<Pick<SetDraft, 'weight' | 'reps' | 'count'>> = {},
  raw: Partial<Record<SetDraftField, string>> = {},
): SetDraft => ({
  ...BLANK_DRAFT,
  ...numbers,
  raw: { ...BLANK_DRAFT.raw, ...raw },
})

const clone = (draft: SetDraft): SetDraft => JSON.parse(JSON.stringify(draft))

const errorMessageOf = (act: () => unknown): string => {
  try {
    act()
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    return (error as Error).message
  }
  throw new Error('expected the call to throw, but it returned')
}

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns only lowercase hex characters', () => {
    expect(generateId()).toMatch(/^[0-9a-f]+$/)
  })

  it('returns a different value on two consecutive calls', () => {
    expect(generateId()).not.toBe(generateId())
  })

  it('returns hex-shaped, every-distinct ids across a large batch, so it is not a constant', () => {
    const ids = Array.from({ length: 500 }, generateId)
    expect(new Set(ids).size).toBe(500)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]+$/)
    }
  })
})

describe('createBlankSetDraft', () => {
  it('holds no number in any of the three fields and no text in any raw', () => {
    const draft = createBlankSetDraft()
    expect(draft.weight).toBeNull()
    expect(draft.reps).toBeNull()
    expect(draft.count).toBeNull()
    expect(draft.raw).toEqual({ weight: '', reps: '', count: '' })
  })

  it('is the blank shape exactly, once the id is set aside', () => {
    const draft = createBlankSetDraft()
    expect({ ...draft, id: 'draft-1' }).toEqual(BLANK_DRAFT)
  })

  it('carries exactly the five documented keys', () => {
    expect(Object.keys(createBlankSetDraft()).sort()).toEqual(
      ['count', 'id', 'raw', 'reps', 'weight'],
    )
  })

  it('carries exactly the three raw keys, so no field is missing or invented', () => {
    expect(Object.keys(createBlankSetDraft().raw).sort()).toEqual([
      'count',
      'reps',
      'weight',
    ])
  })

  it('gives the row a non-empty hex id', () => {
    expect(createBlankSetDraft().id).toMatch(/^[0-9a-f]+$/)
  })

  it('gives two fresh rows different ids', () => {
    expect(createBlankSetDraft().id).not.toBe(createBlankSetDraft().id)
  })
})

describe('isBlankSetDraft', () => {
  it('is true for a row with no number and no text anywhere', () => {
    expect(isBlankSetDraft(BLANK_DRAFT)).toBe(true)
  })

  it('is true for a freshly created row', () => {
    expect(isBlankSetDraft(createBlankSetDraft())).toBe(true)
  })

  it('ignores the id when deciding blankness', () => {
    expect(isBlankSetDraft({ ...BLANK_DRAFT, id: 'any-other-id' })).toBe(true)
  })

  const NOT_BLANK: Array<[string, SetDraft]> = [
    ['a typed zero weight', draftWith({ weight: 0 }, { weight: '0' })],
    ['a zero weight with no text', draftWith({ weight: 0 })],
    ['a zero reps', draftWith({ reps: 0 }, { reps: '0' })],
    ['a zero count', draftWith({ count: 0 }, { count: '0' })],
    ['a weight number', draftWith({ weight: 135 })],
    ['a reps number', draftWith({ reps: 5 })],
    ['a count number', draftWith({ count: 3 })],
    ['junk weight text', draftWith({}, { weight: 'heavy' })],
    ['junk reps text', draftWith({}, { reps: 'abc' })],
    ['junk count text', draftWith({}, { count: '??' })],
    ['whitespace-only weight text', draftWith({}, { weight: ' ' })],
    ['whitespace-only reps text', draftWith({}, { reps: '\t' })],
    ['whitespace-only count text', draftWith({}, { count: '\n' })],
    ['a fully filled row', draftWith({ weight: 135, reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' })],
  ]

  it.each(NOT_BLANK)('is false when only %s is present', (_label, draft) => {
    expect(isBlankSetDraft(draft)).toBe(false)
  })

  it('does not treat a typed zero as blank, the bug the draft type exists to fix', () => {
    expect(isBlankSetDraft(draftWith({ weight: 0, reps: 0, count: 0 }, { weight: '0', reps: '0', count: '0' }))).toBe(false)
  })

  it('returns a boolean, never a truthy value', () => {
    expect(typeof isBlankSetDraft(BLANK_DRAFT)).toBe('boolean')
    expect(typeof isBlankSetDraft(draftWith({ weight: 1 }))).toBe('boolean')
  })
})

describe('isCollapsibleSetDraft', () => {
  const COLLAPSIBLE: Array<[string, SetDraft]> = [
    [
      'a weight, reps and count',
      draftWith({ weight: 135, reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' }),
    ],
    [
      'a weight and reps with a blank count',
      draftWith({ weight: 135, reps: 5 }, { weight: '135', reps: '5', count: '' }),
    ],
    [
      'a weight and reps with junk count text',
      draftWith({ weight: 135, reps: 5 }, { weight: '135', reps: '5', count: 'heavy' }),
    ],
    [
      'a zero weight and zero reps',
      draftWith({ weight: 0, reps: 0, count: 1 }, { weight: '0', reps: '0', count: '1' }),
    ],
    [
      'a zero weight and zero reps with a blank count',
      draftWith({ weight: 0, reps: 0 }, { weight: '0', reps: '0' }),
    ],
    [
      'a negative weight and reps',
      draftWith({ weight: -5, reps: -1 }, { weight: '-5', reps: '-1' }),
    ],
    [
      'a fractional weight and reps',
      draftWith({ weight: 135.5, reps: 2.5 }, { weight: '135.5', reps: '2.5' }),
    ],
  ]

  it.each(COLLAPSIBLE)('is true for %s', (_label, draft) => {
    expect(isCollapsibleSetDraft(draft)).toBe(true)
  })

  const NOT_COLLAPSIBLE: Array<[string, SetDraft]> = [
    [
      'a null weight with reps and count filled',
      draftWith({ reps: 5, count: 3 }, { reps: '5', count: '3' }),
    ],
    [
      'a null reps with weight and count filled',
      draftWith({ weight: 135, count: 3 }, { weight: '135', count: '3' }),
    ],
    [
      'a null weight and null reps',
      draftWith({ count: 3 }, { count: '3' }),
    ],
    ['a fully blank row', BLANK_DRAFT],
    [
      'text in weight and reps but no parsed numbers',
      draftWith({}, { weight: '135', reps: '5' }),
    ],
    [
      'junk in weight and reps',
      draftWith({}, { weight: 'heavy', reps: 'lots' }),
    ],
  ]

  it.each(NOT_COLLAPSIBLE)('is false for %s', (_label, draft) => {
    expect(isCollapsibleSetDraft(draft)).toBe(false)
  })

  it('reads the parsed numbers, never the raw text', () => {
    expect(isCollapsibleSetDraft(draftWith({}, { weight: '135', reps: '5' }))).toBe(false)
    expect(isCollapsibleSetDraft(draftWith({ weight: 135, reps: 5 }, { weight: '', reps: '' }))).toBe(true)
  })

  it('never requires a count, so a blank-count row can still collapse', () => {
    expect(isCollapsibleSetDraft(draftWith({ weight: 135, reps: 5 }))).toBe(true)
  })

  it('returns a boolean, never a truthy value', () => {
    expect(typeof isCollapsibleSetDraft(BLANK_DRAFT)).toBe('boolean')
    expect(typeof isCollapsibleSetDraft(draftWith({ weight: 1, reps: 1 }))).toBe('boolean')
  })
})

describe('toWorkoutSet', () => {
  it('maps the draft to a workout set', () => {
    const draft: SetDraft = {
      id: 'a',
      weight: 135,
      reps: 5,
      count: 3,
      raw: { weight: '135', reps: '5', count: '3' },
    }
    expect(toWorkoutSet(draft)).toEqual({ id: 'a', reps: 5, weight: 135, count: 3 })
  })

  it('carries exactly the four set keys, so raw never leaks into the saved line', () => {
    const result = toWorkoutSet(draftWith({ weight: 135, reps: 5, count: 3 }))
    expect(Object.keys(result).sort()).toEqual(['count', 'id', 'reps', 'weight'])
  })

  it('passes a real zero straight through without throwing', () => {
    const draft = draftWith({ weight: 0, reps: 0, count: 0 }, { weight: '0', reps: '0', count: '0' })
    expect(() => toWorkoutSet(draft)).not.toThrow()
    expect(toWorkoutSet(draft)).toEqual({ id: 'draft-1', reps: 0, weight: 0, count: 0 })
  })

  it('preserves the exact numbers it was handed, negatives and fractions included', () => {
    const draft = draftWith({ weight: -12.5, reps: 0.5, count: 12 }, { weight: '-12.5', reps: '0.5', count: '12' })
    expect(toWorkoutSet(draft)).toEqual({ id: 'draft-1', reps: 0.5, weight: -12.5, count: 12 })
  })

  it('does not default a missing count to one — the blank-means-one rule lives in the domain', () => {
    const draft = draftWith({ weight: 135, reps: 5 }, { weight: '135', reps: '5' })
    expect(() => toWorkoutSet(draft)).toThrow(/count/)
  })

  const THROWS: Array<[string, SetDraft, string, string[]]> = [
    [
      'a null weight',
      draftWith({ reps: 5, count: 3 }, { reps: '5', count: '3' }),
      'weight',
      ['reps', 'count'],
    ],
    [
      'a null reps',
      draftWith({ weight: 135, count: 3 }, { weight: '135', count: '3' }),
      'reps',
      ['weight', 'count'],
    ],
    [
      'a null count',
      draftWith({ weight: 135, reps: 5 }, { weight: '135', reps: '5' }),
      'count',
      ['weight', 'reps'],
    ],
    [
      'a null weight whose raw text looks like a number',
      draftWith({ reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' }),
      'weight',
      ['reps', 'count'],
    ],
  ]

  it.each(THROWS)('throws naming only %s when it is null', (_label, draft, named, others) => {
    const message = errorMessageOf(() => toWorkoutSet(draft))
    expect(message).toContain(named)
    for (const other of others) {
      expect(message).not.toContain(other)
    }
  })

  it('throws for every null field at once', () => {
    expect(() => toWorkoutSet(BLANK_DRAFT)).toThrow(Error)
  })

  const READ_ONLY: Array<[string, SetDraft]> = [
    ['a blank draft', BLANK_DRAFT],
    ['a filled draft', draftWith({ weight: 135, reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' })],
    ['a zero draft', draftWith({ weight: 0, reps: 0, count: 0 }, { weight: '0', reps: '0', count: '0' })],
    ['a junk draft', draftWith({}, { weight: 'heavy', reps: 'lots', count: 'nope' })],
  ]

  it.each(READ_ONLY)('leaves %s untouched', (_label, draft) => {
    const before = clone(draft)
    isBlankSetDraft(draft)
    isCollapsibleSetDraft(draft)
    try {
      toWorkoutSet(draft)
    } catch {
      // a null field throws by contract; the draft must still be untouched
    }
    expect(draft).toEqual(before)
    expect(draft.raw).toEqual(before.raw)
  })

  it('returns a new object, so mutating the result cannot corrupt the draft', () => {
    const draft = draftWith({ weight: 135, reps: 5, count: 3 }, { weight: '135', reps: '5', count: '3' })
    const before = clone(draft)
    const result = toWorkoutSet(draft)
    expect(result).not.toBe(draft)
    result.weight = 999
    result.reps = 1
    expect(draft).toEqual(before)
  })
})
