import { describe, it, expect } from 'vitest'
import {
  validateSet,
  calculateVolume,
  getSetCount,
  calculateSetCount,
  calculateRepTotal,
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
      label: 'fractional reps above the floor, which the pre-branch `reps < 1` rule always accepted',
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
    { label: 'the fractional 0.5, above zero but below one whole rep', reps: 0.5 },
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
    expect(repsMessage).toMatch(/at least 1/i)
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

  const unusableCounts: { label: string; count: unknown }[] = [
    { label: '0, which the clamp lifts back to one', count: 0 },
    { label: 'the negative -2', count: -2 },
    { label: '0.5, which floors to 0 and is then lifted back to one', count: 0.5 },
    { label: 'NaN', count: NaN },
    { label: 'Infinity', count: Infinity },
  ]

  it.each(unusableCounts)('charges one set for a line whose count is $label', ({ count }) => {
    expect(calculateVolume([{ reps: 5, weight: 100, count: count as number }])).toBe(500)
  })

  it('keeps every earlier line intact when only a later line carries an unusable count', () => {
    expect(
      calculateVolume([
        { reps: 5, weight: 100, count: 3 },
        { reps: 5, weight: 100 },
        { reps: 5, weight: 100, count: 0 },
      ]),
    ).toBe(2500)
  })

  it('asks the shared rule how many sets a line is worth instead of counting the line itself', () => {
    const line = { reps: 7, weight: 45, count: '3' } as unknown as {
      reps: number
      weight: number
      count?: number
    }

    expect(calculateVolume([line])).toBe(getSetCount(line) * 45 * 7)
  })
})

function messageThrownBy(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }

  throw new Error('the write path was expected to throw and did not')
}

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

  const unusableCounts: { label: string; count: unknown }[] = [
    { label: '0', count: 0 },
    { label: 'the negative -1', count: -1 },
    { label: '0.5, which floors to 0', count: 0.5 },
    { label: '-0.5, a legal HTML float that floors to -1', count: -0.5 },
    { label: 'NaN', count: NaN },
    { label: '-Infinity', count: -Infinity },
    { label: 'the non-numeric string "heavy"', count: 'heavy' },
    {
      label: 'the numeric string "3", which a coercing isFinite would have read as three',
      count: '3',
    },
    { label: 'the boolean true', count: true },
  ]

  it.each(unusableCounts)('reads one set for the unusable count $label', ({ count }) => {
    expect(getSetCount({ count: count as number })).toBe(1)
  })

  it('reads one set for Infinity, which both Math.floor and the clamp would have let through', () => {
    expect(getSetCount({ count: Infinity })).toBe(1)
  })

  it('leaves a stored line carrying a corrupt count exactly as it found it', () => {
    const line = { count: '3' } as unknown as { count?: number }

    expect(getSetCount(line)).toBe(1)
    expect(line).toEqual({ count: '3' })
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

  it('folds a lone line whose count is 0 to one set rather than refusing it', () => {
    expect(collapseSets([{ id: 'a', reps: 5, weight: 100, count: 0 }])).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 1 },
    ])
  })

  it('folds the whole list when only a later line carries an unusable count', () => {
    expect(
      collapseSets([
        { id: 'a', reps: 5, weight: 100, count: 3 },
        { id: 'b', reps: 5, weight: 100, count: NaN },
      ]),
    ).toStrictEqual([{ id: 'a', reps: 5, weight: 100, count: 4 }])
  })
})

describe('getSetCount on a line deserialized from the workout_logs sets column', () => {
  const storedLine = (): WorkoutSet =>
    JSON.parse('{"id":"s1","reps":5,"weight":100}') as WorkoutSet

  it('reads a pre-count stored line as exactly one set', () => {
    const line = storedLine()

    expect('count' in line).toBe(false)
    expect(getSetCount(line)).toBe(1)
  })

  it('reads the same stored line the same way twice, so a count column and a day total cannot disagree', () => {
    const line = storedLine()

    expect(getSetCount(line)).toBe(1)
    expect(getSetCount(line)).toBe(1)
    expect(line).toStrictEqual({ id: 's1', reps: 5, weight: 100 })
  })
})

describe('calculateSetCount', () => {
  type SetLine = { reps?: number; weight?: number; count?: number }

  const cases: { label: string; sets: SetLine[]; expected: number }[] = [
    { label: 'an empty list, which is zero sets and never one', sets: [], expected: 0 },

    {
      label: 'two legacy lines, which are worth exactly the two rows they are',
      sets: [
        { reps: 10, weight: 100 },
        { reps: 10, weight: 125 },
      ],
      expected: 2,
    },
    {
      label: 'three legacy lines at one rep count, worth exactly three rows',
      sets: [
        { reps: 8, weight: 50 },
        { reps: 8, weight: 55 },
        { reps: 8, weight: 60 },
      ],
      expected: 3,
    },
    {
      label: 'the three Squat rows behind the War Logs session figure, worth exactly three rows',
      sets: [
        { reps: 5, weight: 135 },
        { reps: 5, weight: 155 },
        { reps: 5, weight: 175 },
      ],
      expected: 3,
    },

    { label: 'one line performed three times', sets: [{ count: 3 }], expected: 3 },
    {
      label: 'two lines performed three and two times',
      sets: [{ count: 3 }, { count: 2 }],
      expected: 5,
    },
    {
      label: 'three lines each performed once, which is the same tally as three legacy rows',
      sets: [{ count: 1 }, { count: 1 }, { count: 1 }],
      expected: 3,
    },
    { label: 'one line performed twelve times', sets: [{ count: 12 }], expected: 12 },

    {
      label: 'one legacy line beside one line performed three times',
      sets: [{ reps: 10, weight: 100 }, { reps: 5, weight: 135, count: 3 }],
      expected: 4,
    },
    {
      label: 'two legacy lines beside one line performed three times',
      sets: [
        { reps: 10, weight: 100 },
        { reps: 10, weight: 125 },
        { reps: 5, weight: 135, count: 3 },
      ],
      expected: 5,
    },

    {
      label: 'one line whose count is the explicit 0, which the shared rule lifts to one',
      sets: [{ count: 0 }],
      expected: 1,
    },
    {
      label: 'one line whose count is the negative -1',
      sets: [{ count: -1 }],
      expected: 1,
    },
    {
      label: 'one line whose count is the fractional 2.7',
      sets: [{ count: 2.7 }],
      expected: 2,
    },
    {
      label: 'one line whose count is NaN',
      sets: [{ count: NaN }],
      expected: 1,
    },

    {
      label:
        'three lines all carrying the explicit 0, clamped one at a time so the tally still equals the row count',
      sets: [{ count: 0 }, { count: 0 }, { count: 0 }],
      expected: 3,
    },
    {
      label: 'two lines carrying 0.5, each floored and lifted on its own instead of the sum being floored',
      sets: [{ count: 0.5 }, { count: 0.5 }],
      expected: 2,
    },
    {
      label:
        'a counted line, a legacy line and an unusable line in one list, where the bad line costs one and costs nothing to its neighbours',
      sets: [{ count: 3 }, {}, { count: 0.5 }],
      expected: 5,
    },
    {
      label:
        'a hand-edited numeric string count beside a real one, where the sum stays a number instead of concatenating',
      sets: [{ count: '3' }, { count: 2 }] as unknown as SetLine[],
      expected: 3,
    },
  ]

  it.each(cases)('tallies $label as $expected', ({ sets, expected }) => {
    expect(calculateSetCount(sets)).toBe(expected)
  })

  it.each(cases)('answers the $label list with a whole number at least its row count', ({ sets }) => {
    const total = calculateSetCount(sets)

    expect(Number.isInteger(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(sets.length)
  })

  it('reads the list without rewriting it — same line objects, same keys, same values', () => {
    const legacy = { reps: 10, weight: 100 }
    const counted = { reps: 5, weight: 135, count: 3 }
    const fractional = { count: 2.7 }
    const sets: SetLine[] = [legacy, counted, fractional]

    expect(calculateSetCount(sets)).toBe(6)

    expect(sets).toHaveLength(3)
    expect(sets[0]).toBe(legacy)
    expect(sets[1]).toBe(counted)
    expect(sets[2]).toBe(fractional)
    expect(legacy).toStrictEqual({ reps: 10, weight: 100 })
    expect(counted).toStrictEqual({ reps: 5, weight: 135, count: 3 })
    expect(fractional).toStrictEqual({ count: 2.7 })
  })
})

describe('calculateRepTotal', () => {
  type RepLine = { reps: number; weight?: number; count?: number }

  const twoLegacyBenchRows: RepLine[] = [
    { reps: 10, weight: 100 },
    { reps: 10, weight: 125 },
  ]
  const threeLegacyRowsOfEight: RepLine[] = [
    { reps: 8, weight: 50 },
    { reps: 8, weight: 55 },
    { reps: 8, weight: 60 },
  ]
  const threeLegacyRowsOfFiveFiveThree: RepLine[] = [
    { reps: 5, weight: 185 },
    { reps: 5, weight: 225 },
    { reps: 3, weight: 275 },
  ]

  const cases: { label: string; sets: RepLine[]; expected: number }[] = [
    { label: 'an empty list, which is zero reps and never one', sets: [], expected: 0 },

    {
      label: 'two legacy rows of 10 reps, worth exactly the plain sum of their reps',
      sets: twoLegacyBenchRows,
      expected: 20,
    },
    {
      label: 'three legacy rows of 8 reps, worth exactly the plain sum of their reps',
      sets: threeLegacyRowsOfEight,
      expected: 24,
    },
    {
      label: 'the legacy rows of 5, 5 and 3 reps, worth exactly the plain sum of their reps',
      sets: threeLegacyRowsOfFiveFiveThree,
      expected: 13,
    },

    { label: 'one line of 5 reps performed 3 times', sets: [{ reps: 5, count: 3 }], expected: 15 },
    {
      label: 'three separate lines of 5 reps, the same tally as one line performed 3 times',
      sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }],
      expected: 15,
    },
    {
      label: 'the 12x2 and 5x3 pair behind the War Logs session figure, 24 plus 15',
      sets: [
        { reps: 12, count: 2 },
        { reps: 5, count: 3 },
      ],
      expected: 39,
    },

    {
      label: 'one legacy line beside one line of 5 reps performed 3 times',
      sets: [{ reps: 10, weight: 100 }, { reps: 5, weight: 135, count: 3 }],
      expected: 25,
    },
    {
      label: 'two legacy lines beside one line of 5 reps performed 3 times',
      sets: [
        { reps: 10, weight: 100 },
        { reps: 10, weight: 125 },
        { reps: 5, weight: 135, count: 3 },
      ],
      expected: 35,
    },

    {
      label: 'zero reps performed 3 times, where the count floor must not leak into the reps',
      sets: [{ reps: 0, count: 3 }],
      expected: 0,
    },
    {
      label: 'zero reps performed 3 times beside 5 reps performed twice',
      sets: [
        { reps: 0, count: 3 },
        { reps: 5, count: 2 },
      ],
      expected: 10,
    },

    {
      label: '5 reps whose count is the explicit 0, which the shared rule lifts to one',
      sets: [{ reps: 5, count: 0 }],
      expected: 5,
    },
    {
      label: '5 reps whose count is the negative -2, which the shared rule lifts to one',
      sets: [{ reps: 5, count: -2 }],
      expected: 5,
    },
    {
      label: '5 reps whose count is the fractional 2.7, which the shared rule floors to 2',
      sets: [{ reps: 5, count: 2.7 }],
      expected: 10,
    },
    {
      label: '5 reps whose count is NaN, which the shared rule reads as one',
      sets: [{ reps: 5, count: NaN }],
      expected: 5,
    },
  ]

  it.each(cases)('tallies $label as $expected', ({ sets, expected }) => {
    expect(calculateRepTotal(sets)).toBe(expected)
  })

  const legacyLists: { label: string; sets: RepLine[] }[] = [
    { label: 'two legacy rows of 10 reps', sets: twoLegacyBenchRows },
    { label: 'three legacy rows of 8 reps', sets: threeLegacyRowsOfEight },
    { label: 'the legacy rows of 5, 5 and 3 reps', sets: threeLegacyRowsOfFiveFiveThree },
  ]

  it.each(legacyLists)(
    'returns the plain sum of reps for $label, so no pre-count number on the War Logs screen ever moves',
    ({ sets }) => {
      const plainSum = sets.reduce((total, line) => total + line.reps, 0)

      expect(calculateRepTotal(sets)).toBe(plainSum)
    },
  )

  it('tallies three separate lines of 5 reps exactly as one line of 5 performed 3 times', () => {
    const threeLines = calculateRepTotal([{ reps: 5 }, { reps: 5 }, { reps: 5 }])
    const oneCollapsedLine = calculateRepTotal([{ reps: 5, count: 3 }])

    expect(threeLines).toBe(oneCollapsedLine)
  })

  it('answers the same 10 whether the line carries weight 999 or carries no weight at all', () => {
    const weightedLine: RepLine = { reps: 5, weight: 999, count: 2 }
    const unweightedLine: RepLine = { reps: 5, count: 2 }

    const weighted = calculateRepTotal([weightedLine])
    const unweighted = calculateRepTotal([unweightedLine])

    expect(unweighted).toBe(10)
    expect(weighted).toBe(unweighted)
  })

  const weightCases: { label: string; weight: number }[] = [
    { label: 'the zero 0, which cannot zero the reps it is not consulted for', weight: 0 },
    { label: 'NaN, which would poison the total were it ever read', weight: NaN },
  ]

  it.each(weightCases)('tallies a line carrying weight $label as 10 all the same', ({ weight }) => {
    const line: RepLine = { reps: 5, weight, count: 2 }

    expect(calculateRepTotal([line])).toBe(10)
  })

  it('asks the shared rule how many times a line was performed instead of defaulting the count itself', () => {
    const line = { reps: 5, count: '3' } as unknown as RepLine

    expect(calculateRepTotal([line])).toBe(getSetCount(line) * 5)
    expect(calculateRepTotal([line])).toBe(5)
  })

  const passThroughCases: { label: string; sets: RepLine[]; expected: number }[] = [
    {
      label:
        'a line of -1 reps, which validateSet refuses on the write path and this read path only reports',
      sets: [{ reps: -1 }],
      expected: -1,
    },
    {
      label: 'a line of 2.5 reps, whose fraction the count floor never reaches',
      sets: [{ reps: 2.5, count: 2 }],
      expected: 5,
    },
  ]

  it.each(passThroughCases)('passes $label through as $expected', ({ sets, expected }) => {
    expect(calculateRepTotal(sets)).toBe(expected)
  })

  it.each(cases)('answers the $label list with a whole number at least zero', ({ sets }) => {
    const total = calculateRepTotal(sets)

    expect(Number.isInteger(total)).toBe(true)
    expect(total).toBeGreaterThanOrEqual(0)
  })

  it('reads the list without rewriting it — same line objects, same keys, same values', () => {
    const legacy = { reps: 10, weight: 100 }
    const counted = { reps: 5, weight: 135, count: 3 }
    const fractional = { reps: 5, count: 2.7 }
    const zeroed = { reps: 0, count: 3 }
    const sets: RepLine[] = [legacy, counted, fractional, zeroed]

    expect(calculateRepTotal(sets)).toBe(35)

    expect(sets).toHaveLength(4)
    expect(sets[0]).toBe(legacy)
    expect(sets[1]).toBe(counted)
    expect(sets[2]).toBe(fractional)
    expect(sets[3]).toBe(zeroed)
    expect(legacy).toStrictEqual({ reps: 10, weight: 100 })
    expect(counted).toStrictEqual({ reps: 5, weight: 135, count: 3 })
    expect(fractional).toStrictEqual({ reps: 5, count: 2.7 })
    expect(zeroed).toStrictEqual({ reps: 0, count: 3 })
  })
})
