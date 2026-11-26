import { describe, it, expect } from 'vitest'
import {
  validateSet,
  calculateVolume,
  getSetCount,
  collapseSets,
  WorkoutLog,
} from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

describe('validateSet', () => {
  const EMPTY_ARRAY_MESSAGE = 'Must log at least one set'

  const weightMessage = messageThrownBy(() => validateSet({ id: 's1', reps: 5, weight: 0 }))
  const repsMessage = messageThrownBy(() => validateSet({ id: 's1', reps: 0, weight: 100 }))
  const countMessage = messageThrownBy(() =>
    validateSet({ id: 's1', reps: 5, weight: 100, count: 0 }),
  )

  const legalCases: { label: string; set: WorkoutSet }[] = [
    { label: 'a plain legacy line with no count at all', set: { id: 's1', reps: 5, weight: 100 } },
    { label: 'a line carrying count 3', set: { id: 's1', reps: 5, weight: 100, count: 3 } },
    { label: 'a line carrying the floor boundary count 1', set: { id: 's1', reps: 5, weight: 100, count: 1 } },
    {
      label: 'a line carrying the fractional count 2.5, floored later by the read rule',
      set: { id: 's1', reps: 5, weight: 100, count: 2.5 },
    },
    {
      label: 'a line whose count is explicitly undefined',
      set: { id: 's1', reps: 5, weight: 100, count: undefined },
    },
    {
      label: 'a line whose count is null, absent meaning one set rather than an error',
      set: { id: 's1', reps: 5, weight: 100, count: null } as unknown as WorkoutSet,
    },
    {
      label: 'fractional reps, never promised to be whole',
      set: { id: 's1', reps: 2.5, weight: 60 },
    },
  ]

  it.each(legalCases)('accepts $label', ({ set }) => {
    expect(() => validateSet(set)).not.toThrow()
  })

  const weightRejections: { label: string; weight: unknown }[] = [
    { label: '0, which the old rule let through', weight: 0 },
    { label: 'the negative -10', weight: -10 },
    { label: 'NaN', weight: NaN },
    { label: 'Infinity', weight: Infinity },
    { label: '-Infinity', weight: -Infinity },
    { label: 'the non-numeric string "heavy"', weight: 'heavy' },
    { label: 'the boolean true', weight: true },
  ]

  it.each(weightRejections)('refuses a weight of $label', ({ weight }) => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: weight as number }

    expect(() => validateSet(set)).toThrow(new Error(weightMessage))
  })

  const repsRejections: { label: string; reps: unknown }[] = [
    { label: '0', reps: 0 },
    { label: 'the negative -1', reps: -1 },
    { label: 'NaN', reps: NaN },
    { label: 'Infinity', reps: Infinity },
    { label: '-Infinity', reps: -Infinity },
    { label: 'the non-numeric string "five"', reps: 'five' },
  ]

  it.each(repsRejections)('refuses a reps of $label', ({ reps }) => {
    const set: WorkoutSet = { id: 's1', reps: reps as number, weight: 100 }

    expect(() => validateSet(set)).toThrow(new Error(repsMessage))
  })

  const countRejections: { label: string; count: unknown }[] = [
    { label: '0', count: 0 },
    { label: 'the negative -1', count: -1 },
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
    { label: '-Infinity', count: -Infinity },
    { label: 'the non-numeric string "three"', count: 'three' },
  ]

  it.each(countRejections)('refuses a count of $label', ({ count }) => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: 100, count: count as number }

    expect(() => validateSet(set)).toThrow(new Error(countMessage))
  })

  it('reports the weight problem when every field is bad at once', () => {
    const set: WorkoutSet = { id: 's1', reps: 0, weight: 0, count: 0 }

    expect(() => validateSet(set)).toThrow(new Error(weightMessage))
    expect(messageThrownBy(() => validateSet(set))).not.toBe(repsMessage)
    expect(messageThrownBy(() => validateSet(set))).not.toBe(countMessage)
  })

  it('reports the reps problem before the count problem', () => {
    const set: WorkoutSet = { id: 's1', reps: 0, weight: 100, count: 0 }

    expect(() => validateSet(set)).toThrow(new Error(repsMessage))
    expect(messageThrownBy(() => validateSet(set))).not.toBe(countMessage)
  })

  it('names the weight field and tells the lifter what to do', () => {
    expect(weightMessage).toMatch(/weight/i)
    expect(weightMessage).toMatch(/more than 0/i)
    expect(weightMessage).toMatch(/remove the line/i)
  })

  it('names the reps field and tells the lifter what to do', () => {
    expect(repsMessage).toMatch(/reps/i)
    expect(repsMessage).toMatch(/more than 0/i)
    expect(repsMessage).toMatch(/remove the line/i)
  })

  it('names the set count and tells the lifter what to do', () => {
    expect(countMessage).toMatch(/count/i)
    expect(countMessage).toMatch(/at least 1/i)
    expect(countMessage).toMatch(/how many sets you did/i)
    expect(countMessage).toMatch(/leave it blank for one/i)
  })

  it('never mistakes a reps failure for a weight failure', () => {
    expect(repsMessage).not.toMatch(/weight/i)
  })

  it('never mistakes a count failure for a weight or reps failure', () => {
    expect(countMessage).not.toMatch(/weight/i)
    expect(countMessage).not.toMatch(/reps/i)
  })

  it('throws a message unique to each of the three fields', () => {
    expect(weightMessage).not.toBe(repsMessage)
    expect(weightMessage).not.toBe(countMessage)
    expect(repsMessage).not.toBe(countMessage)
  })

  it('never borrows the write path empty-array message', () => {
    expect(weightMessage).not.toBe(EMPTY_ARRAY_MESSAGE)
    expect(repsMessage).not.toBe(EMPTY_ARRAY_MESSAGE)
    expect(countMessage).not.toBe(EMPTY_ARRAY_MESSAGE)
  })

  it('throws an Error instance from every refusal', () => {
    expect(() => validateSet({ id: 's1', reps: 5, weight: 0 })).toThrowError(Error)
    expect(() => validateSet({ id: 's1', reps: 0, weight: 100 })).toThrowError(Error)
    expect(() => validateSet({ id: 's1', reps: 5, weight: 100, count: 0 })).toThrowError(Error)
  })
})

describe('calculateVolume', () => {
  it('returns 0 for an empty array', () => {
    expect(calculateVolume([])).toBe(0)
  })

  it('calculates volume for a single set', () => {
    expect(calculateVolume([{ reps: 5, weight: 100 }])).toBe(500)
  })

  it('calculates volume for multiple sets', () => {
    const sets = [
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
    ]
    expect(calculateVolume(sets)).toBe(1500)
  })

  it('handles varying reps and weights', () => {
    const sets = [
      { reps: 5, weight: 100 },
      { reps: 4, weight: 110 },
      { reps: 3, weight: 120 },
    ]
    expect(calculateVolume(sets)).toBe(500 + 440 + 360)
  })

  const countedCases: {
    label: string
    sets: { reps: number; weight: number; count?: number }[]
    expected: number
  }[] = [
    {
      label: 'a line carrying count 3 is the work multiplied by three',
      sets: [{ reps: 5, weight: 135, count: 3 }],
      expected: 2025,
    },
    {
      label: 'a line with no count is exactly what it always was',
      sets: [{ reps: 5, weight: 135 }],
      expected: 675,
    },
    {
      label: 'an explicit count of 1 is identical to an absent count',
      sets: [{ reps: 5, weight: 135, count: 1 }],
      expected: 675,
    },
    {
      label: 'one line counted once sits beside its twin counted three times',
      sets: [
        { reps: 5, weight: 100 },
        { reps: 5, weight: 100, count: 3 },
      ],
      expected: 2000,
    },
    {
      label: 'a fractional count floors before the multiply',
      sets: [{ reps: 10, weight: 50, count: 2.7 }],
      expected: 1000,
    },
    {
      label: 'each line floors on its own instead of the total flooring',
      sets: [
        { reps: 10, weight: 50, count: 2.5 },
        { reps: 10, weight: 50, count: 2.5 },
      ],
      expected: 2000,
    },
    {
      label: 'the same line at count 1 is the unmultiplied base',
      sets: [{ reps: 10, weight: 50, count: 1 }],
      expected: 500,
    },
    {
      label: 'large values stay exact with no float drift',
      sets: [{ reps: 100, weight: 1000, count: 10 }],
      expected: 1000000,
    },
    {
      label: 'zero reps is passed through, being validateSet problem not this one',
      sets: [{ reps: 0, weight: 100, count: 2 }],
      expected: 0,
    },
    {
      label: 'negative reps is passed through, being validateSet problem not this one',
      sets: [{ reps: -1, weight: 100 }],
      expected: -100,
    },
  ]

  it.each(countedCases)('totals $label', ({ sets, expected }) => {
    expect(calculateVolume(sets)).toBe(expected)
  })

  const refusedCounts: { label: string; count: unknown }[] = [
    { label: '0', count: 0 },
    { label: '-2', count: -2 },
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
  ]

  it.each(refusedCounts)('refuses a line whose count is $label', ({ count }) => {
    const total = () => calculateVolume([{ reps: 5, weight: 100, count: count as number }])

    expect(total).toThrow(new Error(REFUSAL_MESSAGE))
  })

  it('refuses the whole total when only a later line carries a bad count', () => {
    const total = () =>
      calculateVolume([
        { reps: 5, weight: 100 },
        { reps: 5, weight: 100, count: 0 },
      ])

    expect(total).toThrow(new Error(REFUSAL_MESSAGE))
  })

  it('refuses a bad count with the very message the shared rule throws', () => {
    const ruleMessage = messageThrownBy(() => getSetCount({ count: 0 }))

    expect(() => calculateVolume([{ reps: 5, weight: 100, count: 0 }])).toThrow(ruleMessage)
  })
})

function messageThrownBy(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }

  throw new Error('the shared rule was expected to throw and did not')
}

const REFUSAL_MESSAGE =
  'Set count must be at least 1 - enter how many sets you did, or leave it blank for one.'

describe('getSetCount', () => {
  const acceptedCases: { label: string; line: { count?: number }; expected: number }[] = [
    { label: 'the count is absent', line: {}, expected: 1 },
    { label: 'the count is undefined', line: { count: undefined }, expected: 1 },
    {
      label: 'the count is null',
      line: { count: null } as unknown as { count?: number },
      expected: 1,
    },
    { label: 'the count is the floor boundary 1', line: { count: 1 }, expected: 1 },
    { label: 'the count is 3', line: { count: 3 }, expected: 3 },
    { label: 'the count is a large integer 12', line: { count: 12 }, expected: 12 },
    { label: 'the count is 2.7', line: { count: 2.7 }, expected: 2 },
    { label: 'the count is exactly half, 2.5', line: { count: 2.5 }, expected: 2 },
    { label: 'the count is 1.5, just above the floor', line: { count: 1.5 }, expected: 1 },
  ]

  it.each(acceptedCases)('reads $expected when $label', ({ line, expected }) => {
    expect(getSetCount(line)).toBe(expected)
  })

  const refusedCases: { label: string; count: unknown }[] = [
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: '0', count: 0 },
    { label: '-1', count: -1 },
    { label: '-0.5, a legal HTML float that floors to 0', count: -0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
    { label: '-Infinity', count: -Infinity },
    { label: 'the non-numeric string "heavy"', count: 'heavy' },
    { label: 'the numeric string "3", which Math.floor would accept', count: '3' },
    { label: 'the boolean true, which Math.floor would read as 1', count: true },
  ]

  it.each(refusedCases)('refuses the count $label', ({ count }) => {
    const read = () => getSetCount({ count: count as number })

    expect(read).toThrow(REFUSAL_MESSAGE)
  })

  it.each(refusedCases)('tells the lifter what to do when the count is $label', ({ count }) => {
    const read = () => getSetCount({ count: count as number })

    expect(read).toThrow(/count/i)
    expect(read).toThrow(/enter how many sets you did/i)
    expect(read).toThrow(/leave it blank for one/i)
    expect(read).not.toThrow('Must log at least one set')
  })

  it('throws an Error instance, not a bare string', () => {
    expect(() => getSetCount({ count: 0 })).toThrowError(Error)
  })

  it('never stamps the default onto a line that carried no count', () => {
    const line: { count?: number } = {}

    expect(getSetCount(line)).toBe(1)
    expect(Object.keys(line)).not.toContain('count')
    expect(line).toEqual({})
  })

  it('never rewrites a fractional count onto the line it read', () => {
    const line = { count: 2.7 }

    expect(getSetCount(line)).toBe(2)
    expect(line).toEqual({ count: 2.7 })
  })

  it('reads a frozen line without a frozen-object error', () => {
    const line = Object.freeze({ count: 3 })

    expect(() => getSetCount(line)).not.toThrow()
    expect(getSetCount(line)).toBe(3)
  })

  it('reads a frozen line with no count without a frozen-object error', () => {
    const line = Object.freeze({}) as { count?: number }

    expect(() => getSetCount(line)).not.toThrow()
    expect(getSetCount(line)).toBe(1)
  })

  it('leaves the stored line untouched when the same line is read twice', () => {
    const line: WorkoutSet = { id: 's1', reps: 5, weight: 100, count: 4 }

    expect(getSetCount(line)).toBe(4)
    expect(getSetCount(line)).toBe(4)
    expect(line).toEqual({ id: 's1', reps: 5, weight: 100, count: 4 })
  })
})

describe('WorkoutLog type structure', () => {
  it('has the expected shape', () => {
    const log: WorkoutLog = {
      id: 1,
      userId: 1,
      exerciseId: 2,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    expect(log.id).toBe(1)
    expect(log.userId).toBe(1)
    expect(log.exerciseId).toBe(2)
    expect(log.date).toBe('2025-01-01')
    expect(log.sets).toHaveLength(1)
    expect(log.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(log.updatedAt).toBe('2025-01-01T00:00:00.000Z')
  })
})

describe('collapseSets', () => {
  const foldCases: { label: string; sets: WorkoutSet[]; expected: WorkoutSet[] }[] = [
    {
      label: 'nothing folds to nothing',
      sets: [],
      expected: [],
    },
    {
      label: 'a lone legacy line comes back with its count resolved to one',
      sets: [{ id: 'a', reps: 5, weight: 100 }],
      expected: [{ id: 'a', reps: 5, weight: 100, count: 1 }],
    },
    {
      label: 'two lines of the same work become one line counted twice',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 100 },
      ],
      expected: [{ id: 'a', reps: 5, weight: 100, count: 2 }],
    },
    {
      label: 'counts 2, absent and 4 on the same work sum to seven on the first line id',
      sets: [
        { id: 'first', reps: 5, weight: 100, count: 2 },
        { id: 'second', reps: 5, weight: 100 },
        { id: 'third', reps: 5, weight: 100, count: 4 },
      ],
      expected: [{ id: 'first', reps: 5, weight: 100, count: 7 }],
    },
    {
      label: '100kg and 135kg stay two separate lines in the order they arrived',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 135 },
      ],
      expected: [
        { id: 'a', reps: 5, weight: 100, count: 1 },
        { id: 'b', reps: 5, weight: 135, count: 1 },
      ],
    },
    {
      label: '100kg and 101kg are different work however close they sit',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 101 },
      ],
      expected: [
        { id: 'a', reps: 5, weight: 100, count: 1 },
        { id: 'b', reps: 5, weight: 101, count: 1 },
      ],
    },
    {
      label: '5 reps and 6 reps are different work at the same weight',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 6, weight: 100 },
      ],
      expected: [
        { id: 'a', reps: 5, weight: 100, count: 1 },
        { id: 'b', reps: 6, weight: 100, count: 1 },
      ],
    },
    {
      label: 'count is not part of the key, so a line counted once joins its twin counted three times',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 1 },
        { id: 'b', reps: 5, weight: 100, count: 3 },
      ],
      expected: [{ id: 'a', reps: 5, weight: 100, count: 4 }],
    },
    {
      label: 'two lines of count 2.5 each floor to 2 on their own way in and sum to 4',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2.5 },
        { id: 'b', reps: 5, weight: 100, count: 2.5 },
      ],
      expected: [{ id: 'a', reps: 5, weight: 100, count: 4 }],
    },
    {
      label: '2.9 and 2.1 floor apart to 2 plus 2 rather than summing raw to 5',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2.9 },
        { id: 'b', reps: 5, weight: 100, count: 2.1 },
      ],
      expected: [{ id: 'a', reps: 5, weight: 100, count: 4 }],
    },
    {
      label: 'unusable reps and weight are folded rather than judged, that being validateSet contract',
      sets: [
        { id: 'a', reps: -1, weight: -50 },
        { id: 'b', reps: -1, weight: -50 },
      ],
      expected: [{ id: 'a', reps: -1, weight: -50, count: 2 }],
    },
    {
      label: 'a hundred matching lines become one line counted a hundred',
      sets: Array.from({ length: 100 }, (_unused, index) => ({
        id: `s${index}`,
        reps: 5,
        weight: 100,
        count: 1,
      })),
      expected: [{ id: 's0', reps: 5, weight: 100, count: 100 }],
    },
  ]

  it.each(foldCases)('folds $label', ({ sets, expected }) => {
    expect(collapseSets(sets)).toStrictEqual(expected)
  })

  it('emits in order of first occurrence, not sorted and not in the order the matching line arrived', () => {
    const result = collapseSets([
      { id: 'a', reps: 5, weight: 100, count: 1 },
      { id: 'b', reps: 8, weight: 60 },
      { id: 'c', reps: 5, weight: 100, count: 2 },
    ])

    expect(result).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 3 },
      { id: 'b', reps: 8, weight: 60, count: 1 },
    ])
  })

  it('keys on the work alone and keeps the id of the first line for it, however the ids differ', () => {
    const result = collapseSets([
      { id: 'first', reps: 5, weight: 100 },
      { id: 'middle', reps: 5, weight: 100 },
      { id: 'last', reps: 5, weight: 100 },
    ])

    expect(result).toStrictEqual([{ id: 'first', reps: 5, weight: 100, count: 3 }])
  })

  it('treats -0 and 0 as one weight, being one and the same number', () => {
    const result = collapseSets([
      { id: 'a', reps: 5, weight: -0 },
      { id: 'b', reps: 5, weight: 0 },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
  })

  const countKeyCases: { label: string; sets: WorkoutSet[] }[] = [
    {
      label: 'a lone legacy line carried no count at all',
      sets: [{ id: 'a', reps: 5, weight: 100 }],
    },
    {
      label: 'a lone line carried its own count',
      sets: [{ id: 'a', reps: 5, weight: 100, count: 3 }],
    },
    {
      label: 'two lines of different work each resolved their own',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 8, weight: 60 },
      ],
    },
    {
      label: 'two lines of the same work merged into one',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 100 },
      ],
    },
  ]

  it.each(countKeyCases)('hands every returned line its own count key, even when $label', ({ sets }) => {
    const result = collapseSets(sets)

    expect(result.length).toBeGreaterThan(0)
    for (const line of result) {
      expect(Object.keys(line)).toContain('count')
    }
  })

  it('returns exactly the four canonical keys, dropping anything else the stored line carried', () => {
    const stored = { id: 'a', reps: 5, weight: 100, note: 'felt heavy' } as WorkoutSet

    expect(collapseSets([stored])).toStrictEqual([{ id: 'a', reps: 5, weight: 100, count: 1 }])
  })

  it('leaves the array it was handed and every line inside it exactly as it found them', () => {
    const sets: WorkoutSet[] = [
      { id: 'a', reps: 5, weight: 100 },
      { id: 'b', reps: 5, weight: 100, count: 2.5 },
      { id: 'c', reps: 8, weight: 60 },
    ]
    const snapshot = sets.map((line) => ({ ...line }))

    collapseSets(sets)

    expect(sets).toEqual(snapshot)
  })

  it('never stamps the resolved count onto a legacy line it read', () => {
    const legacy: WorkoutSet = { id: 'a', reps: 5, weight: 100 }

    collapseSets([legacy, { id: 'b', reps: 5, weight: 100 }])

    expect(Object.keys(legacy)).toEqual(['id', 'reps', 'weight'])
  })

  it('returns a new array, never the one it was handed', () => {
    const sets: WorkoutSet[] = [{ id: 'a', reps: 5, weight: 100 }]

    expect(collapseSets(sets)).not.toBe(sets)
  })

  it('returns brand-new line objects even when a returned line is indistinguishable from the line it came from', () => {
    const line: WorkoutSet = { id: 'a', reps: 5, weight: 100, count: 1 }
    const sets = [line]

    const result = collapseSets(sets)

    expect(result[0]).toEqual(line)
    expect(result[0]).not.toBe(line)
    expect(sets.includes(result[0])).toBe(false)
  })

  it('folds an already-folded list to itself, so a read path may feed it its own output', () => {
    const sets: WorkoutSet[] = [
      { id: 'a', reps: 5, weight: 100 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
      { id: 'c', reps: 8, weight: 60 },
    ]

    const once = collapseSets(sets)

    expect(collapseSets(once)).toStrictEqual(once)
  })

  it('propagates the shared count rule refusal rather than swallowing it', () => {
    const ruleMessage = messageThrownBy(() => getSetCount({ count: 0 }))

    expect(() => collapseSets([{ id: 'a', reps: 5, weight: 100, count: 0 }])).toThrow(ruleMessage)
  })

  it('refuses the whole fold when only a later line carries an unusable count', () => {
    const fold = () =>
      collapseSets([
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 100, count: 0 },
      ])

    expect(fold).toThrow(REFUSAL_MESSAGE)
  })
})
