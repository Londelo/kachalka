import { describe, it, expect } from 'vitest'
import {
  validateSet,
  calculateVolume,
  normalizeSetCount,
  collapseDuplicateSets,
  WorkoutLog,
} from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

describe('validateSet', () => {
  it('passes for a valid set', () => {
    const validSet: WorkoutSet = { id: 's1', reps: 5, weight: 100 }
    expect(() => validateSet(validSet)).not.toThrow()
  })

  it('allows weight of 0', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: 0 }
    expect(() => validateSet(set)).not.toThrow()
  })

  it('throws when weight is negative', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: -10 }
    expect(() => validateSet(set)).toThrow('Weight must be non-negative')
  })

  it('throws when reps is 0', () => {
    const set: WorkoutSet = { id: 's1', reps: 0, weight: 100 }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
  })

  it('throws when reps is negative', () => {
    const set: WorkoutSet = { id: 's1', reps: -1, weight: 100 }
    expect(() => validateSet(set)).toThrow('Reps must be at least 1')
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

describe('normalizeSetCount', () => {
  describe('the floor to one', () => {
    it.each(
      [
        ['an absent count', undefined],
        ['a null count', null],
        ['an empty-string count', ''],
        ['a zero count', 0],
        ['a negative-zero count', -0],
        ['a fraction below one', 0.5],
      ] as [string, unknown][],
    )('reads %s as 1', (_label, raw) => {
      expect(normalizeSetCount(raw)).toBe(1)
    })
  })

  describe('pass-through and the floor boundary', () => {
    it.each(
      [
        ['a whole number as 1', 1, 1],
        ['a whole number written with a decimal point as 1', 1.0, 1],
        ['a larger whole number as 3', 3, 3],
        ['a fraction above one as 2 — floored down, never rounded up', 2.7, 2],
        ['a numeric string as 3', '3', 3],
        ['a numeric string padded with whitespace as 4', ' 4 ', 4],
        ['a fractional numeric string as 3', '3.9', 3],
        ['a zero written as a string as 1', '0', 1],
      ] as [string, unknown, number][],
    )('reads %s', (_label, raw, expected) => {
      expect(normalizeSetCount(raw)).toBe(expected)
    })
  })

  describe('rejection — reported, never silently corrected', () => {
    it.each(
      [
        ['a negative count', -1],
        ['a negative fraction', -0.5],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['-Infinity', -Infinity],
        ["a non-numeric string ('abc')", 'abc'],
        ["a partly-numeric string ('1abc')", '1abc'],
        ['an object', {}],
        ['an array', []],
        ['a boolean', true],
      ] as [string, unknown][],
    )('throws for %s', (_label, raw) => {
      expect(() => normalizeSetCount(raw)).toThrow(/^Set count must be at least 1$/)
    })

    it('rejects -1 rather than clamping it up to the floor', () => {
      let returned: number | undefined = Number.NaN
      let thrown: unknown

      try {
        returned = normalizeSetCount(-1)
      } catch (error) {
        thrown = error
      }

      expect(returned).toBeNaN()
      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe('Set count must be at least 1')
    })
  })
})

describe('validateSet — set count', () => {
  it('accepts a pre-change line that carries no count key at all', () => {
    const legacyLine: WorkoutSet = { id: 's1', reps: 5, weight: 100 }
    expect(() => validateSet(legacyLine)).not.toThrow()
  })

  it.each(
    [
      ['an explicit undefined count', { id: 's1', reps: 5, weight: 100, count: undefined }],
      ['a zero count', { id: 's1', reps: 5, weight: 100, count: 0 }],
      ['an empty-string count', { id: 's1', reps: 5, weight: 100, count: '' }],
      ['a count of 3', { id: 's1', reps: 5, weight: 100, count: 3 }],
    ] as [string, unknown][],
  )('accepts a line with %s', (_label, set) => {
    expect(() => validateSet(set as WorkoutSet)).not.toThrow()
  })

  it.each(
    [
      ['a negative count', { id: 's1', reps: 5, weight: 100, count: -1 }],
      ['a non-numeric count', { id: 's1', reps: 5, weight: 100, count: 'abc' }],
    ] as [string, unknown][],
  )('rejects %s', (_label, set) => {
    expect(() => validateSet(set as WorkoutSet)).toThrow(/^Set count must be at least 1$/)
  })

  it('checks weight ahead of count', () => {
    const set: WorkoutSet = { id: 's1', reps: 5, weight: -10, count: -1 }
    expect(() => validateSet(set)).toThrow(/^Weight must be non-negative$/)
  })
})

describe('collapseDuplicateSets', () => {
  const expectSaneCounts = (lines: WorkoutSet[]) => {
    lines.forEach((line) => {
      expect(typeof line.count).toBe('number')
      expect(Number.isNaN(line.count as number)).toBe(false)
      expect(Number.isInteger(line.count as number)).toBe(true)
      expect(line.count as number).toBeGreaterThanOrEqual(1)
    })
  }

  const suspectCounts: [string, Record<string, unknown>][] = [
    ['an absent count field', {}],
    ['a null count', { count: null }],
    ['a zero count', { count: 0 }],
    ['a negative count', { count: -3 }],
    ['a NaN count', { count: NaN }],
    ['an Infinity count', { count: Infinity }],
    ['a fractional count', { count: 2.5 }],
    ['a numeric-string count', { count: '3' }],
  ]

  const pairWithSuspectCount = (suspect: Record<string, unknown>): WorkoutSet[] => [
    { id: 'first', weight: 135, reps: 5, count: 1 },
    { id: 'second', weight: 135, reps: 5, ...suspect } as WorkoutSet,
  ]

  const triples = (lines: WorkoutSet[]) =>
    lines.map((line) => `${line.weight}|${line.reps}|${line.count}`).sort()

  describe('the match key', () => {
    it('returns an empty array for an empty array', () => {
      expect(collapseDuplicateSets([])).toEqual([])
    })

    it('passes a single line through with its own count', () => {
      expect(collapseDuplicateSets([{ id: 'a', weight: 135, reps: 5, count: 1 }])).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 1 },
      ])
    })

    it('passes a single line through with its count normalised when it carries no usable count', () => {
      expect(collapseDuplicateSets([{ id: 'a', weight: 135, reps: 5, count: 0 }])).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 1 },
      ])
    })

    it('folds two matching lines into one carrying the sum, keeping the first line id', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 2 },
          { id: 'b', weight: 135, reps: 5, count: 3 },
        ]),
      ).toEqual([{ id: 'a', weight: 135, reps: 5, count: 5 }])
    })

    it('keeps two lines separate when only reps differ', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 2 },
          { id: 'b', weight: 135, reps: 6, count: 3 },
        ]),
      ).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 2 },
        { id: 'b', weight: 135, reps: 6, count: 3 },
      ])
    })

    it('keeps two lines separate when only weight differs', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 2 },
          { id: 'b', weight: 140, reps: 5, count: 3 },
        ]),
      ).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 2 },
        { id: 'b', weight: 140, reps: 5, count: 3 },
      ])
    })

    it('keeps two lines separate when both weight and reps differ', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 2 },
          { id: 'b', weight: 140, reps: 6, count: 3 },
        ]),
      ).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 2 },
        { id: 'b', weight: 140, reps: 6, count: 3 },
      ])
    })

    it('folds three matching lines into one carrying all three summed', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 2 },
          { id: 'b', weight: 135, reps: 5, count: 1 },
          { id: 'c', weight: 135, reps: 5, count: 3 },
        ]),
      ).toEqual([{ id: 'a', weight: 135, reps: 5, count: 6 }])
    })

    it('folds matching lines interleaved with a non-matching one and keeps first-occurrence order', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 1 },
          { id: 'b', weight: 140, reps: 5, count: 1 },
          { id: 'c', weight: 135, reps: 5, count: 2 },
        ]),
      ).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 3 },
        { id: 'b', weight: 140, reps: 5, count: 1 },
      ])
    })

    it('emits groups in first-occurrence order rather than sorted by weight', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 140, reps: 5, count: 1 },
          { id: 'b', weight: 135, reps: 5, count: 1 },
          { id: 'c', weight: 135, reps: 5, count: 1 },
        ]),
      ).toEqual([
        { id: 'a', weight: 140, reps: 5, count: 1 },
        { id: 'b', weight: 135, reps: 5, count: 2 },
      ])
    })
  })

  describe('position irrelevance', () => {
    it('sums to the same count whichever of two matching lines arrives first', () => {
      const a: WorkoutSet = { id: 'A', weight: 135, reps: 5, count: 2 }
      const b: WorkoutSet = { id: 'B', weight: 135, reps: 5, count: 3 }

      const ab = collapseDuplicateSets([a, b])
      const ba = collapseDuplicateSets([b, a])

      expect(ab).toHaveLength(1)
      expect(ba).toHaveLength(1)
      expect(ab[0].count).toBe(5)
      expect(ba[0].count).toBe(5)
      expect(ab[0].id).toBe('A')
      expect(ba[0].id).toBe('B')
    })

    it('differs between the two arrival orders by nothing but the surviving id', () => {
      const a: WorkoutSet = { id: 'A', weight: 135, reps: 5, count: 2 }
      const b: WorkoutSet = { id: 'B', weight: 135, reps: 5, count: 3 }

      const stripId = (lines: WorkoutSet[]) => lines.map(({ id, ...rest }) => rest)

      expect(stripId(collapseDuplicateSets([a, b]))).toEqual(
        stripId(collapseDuplicateSets([b, a])),
      )
    })

    it('yields the same set of weight/reps/count triples for a reversed five-line input', () => {
      const five: WorkoutSet[] = [
        { id: 'p1', weight: 135, reps: 5, count: 2 },
        { id: 'p2', weight: 140, reps: 5, count: 3 },
        { id: 'p3', weight: 135, reps: 5, count: 1 },
        { id: 'p4', weight: 100, reps: 8, count: 4 },
        { id: 'p5', weight: 140, reps: 6, count: 1 },
      ]

      expect(triples(collapseDuplicateSets([...five].reverse()))).toEqual(
        triples(collapseDuplicateSets(five)),
      )
    })
  })

  describe('count normalisation', () => {
    it.each(suspectCounts)(
      'counts %s on the second line of a matching pair as exactly one set',
      (_label, suspect) => {
        const result = collapseDuplicateSets(pairWithSuspectCount(suspect))

        expect(result).toEqual([{ id: 'first', weight: 135, reps: 5, count: 2 }])
        expectSaneCounts(result)
      },
    )

    it('never throws on any suspect count', () => {
      suspectCounts.forEach(([_label, suspect]) => {
        expect(() => collapseDuplicateSets(pairWithSuspectCount(suspect))).not.toThrow()
      })
    })

    it('counts a line whose count is absent as one set, never as zero', () => {
      const result = collapseDuplicateSets([
        { id: 'a', weight: 135, reps: 5 },
        { id: 'b', weight: 135, reps: 5 },
        { id: 'c', weight: 135, reps: 5 },
        { id: 'd', weight: 140, reps: 5 },
      ])

      expect(result).toEqual([
        { id: 'a', weight: 135, reps: 5, count: 3 },
        { id: 'd', weight: 140, reps: 5, count: 1 },
      ])
      expectSaneCounts(result)
    })

    it('never emits a count of 0, NaN, undefined, null or a negative across the suspect matrix', () => {
      suspectCounts.forEach(([_label, suspect]) => {
        expectSaneCounts(collapseDuplicateSets(pairWithSuspectCount(suspect)))
      })
    })
  })

  describe('boundaries and odd values', () => {
    it('treats a weight of 0 as a legal weight and folds two such lines', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 0, reps: 5, count: 1 },
          { id: 'b', weight: 0, reps: 5, count: 1 },
        ]),
      ).toEqual([{ id: 'a', weight: 0, reps: 5, count: 2 }])
    })

    it('folds a weight written 135 with one written 135.0', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 1 },
          { id: 'b', weight: 135.0, reps: 5, count: 1 },
        ]),
      ).toEqual([{ id: 'a', weight: 135, reps: 5, count: 2 }])
    })

    it('folds two identical fractional weights', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135.5, reps: 5, count: 1 },
          { id: 'b', weight: 135.5, reps: 5, count: 1 },
        ]),
      ).toEqual([{ id: 'a', weight: 135.5, reps: 5, count: 2 }])
    })

    it('keeps two weights apart that differ only in the seventh decimal place', () => {
      const result = collapseDuplicateSets([
        { id: 'a', weight: 135.5, reps: 5, count: 1 },
        { id: 'b', weight: 135.5000001, reps: 5, count: 1 },
      ])

      expect(result).toHaveLength(2)
      expect(result[0].count).toBe(1)
      expect(result[1].count).toBe(1)
    })

    it('folds reps written 5 with reps written 5.0', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 1 },
          { id: 'b', weight: 135, reps: 5.0, count: 1 },
        ]),
      ).toEqual([{ id: 'a', weight: 135, reps: 5, count: 2 }])
    })

    it('keeps reps 5 apart from reps 6', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 1 },
          { id: 'b', weight: 135, reps: 6, count: 1 },
        ]),
      ).toHaveLength(2)
    })

    it('folds two lines that share weight and reps but carry different ids', () => {
      expect(
        collapseDuplicateSets([
          { id: 'a', weight: 135, reps: 5, count: 1 },
          { id: 'zzz', weight: 135, reps: 5, count: 1 },
        ]),
      ).toEqual([{ id: 'a', weight: 135, reps: 5, count: 2 }])
    })

    it('keeps two lines apart that share an id but differ in reps', () => {
      const result = collapseDuplicateSets([
        { id: 'same', weight: 135, reps: 5, count: 1 },
        { id: 'same', weight: 135, reps: 6, count: 1 },
      ])

      expect(result).toHaveLength(2)
      expect(result.map((line) => line.reps)).toEqual([5, 6])
    })

    it('keeps two lines apart that share an id but differ in weight', () => {
      const result = collapseDuplicateSets([
        { id: 'same', weight: 135, reps: 5, count: 1 },
        { id: 'same', weight: 140, reps: 5, count: 1 },
      ])

      expect(result).toHaveLength(2)
      expect(result.map((line) => line.weight)).toEqual([135, 140])
    })

    it('folds a 50-line array of 25 matching pairs into 25 lines of count 2 each', () => {
      const firsts = Array.from({ length: 25 }, (_unused, i) => ({
        id: `a${i}`,
        weight: 100 + i,
        reps: 5,
        count: 1,
      }))
      const seconds = firsts.map((line, i) => ({ ...line, id: `b${i}` }))

      const result = collapseDuplicateSets([
        ...firsts.flatMap((line, i) => [line, seconds[i]]),
      ])

      expect(result).toHaveLength(25)
      expect(result.map((line) => line.count)).toEqual(Array(25).fill(2))
      expect(result.map((line) => line.id)).toEqual(firsts.map((line) => line.id))
      expectSaneCounts(result)
    })

    it('leaves an all-distinct array the same length with every count unchanged', () => {
      const distinct: WorkoutSet[] = Array.from({ length: 6 }, (_unused, i) => ({
        id: `d${i}`,
        weight: 100 + i * 5,
        reps: 1 + i,
        count: i + 1,
      }))

      const result = collapseDuplicateSets(distinct)

      expect(result).toHaveLength(distinct.length)
      expect(result).toEqual(distinct)
    })
  })

  describe('purity', () => {
    const inputMatrix: WorkoutSet[] = [
      { id: 'a', weight: 135, reps: 5, count: 2 },
      { id: 'b', weight: 140, reps: 5, count: 1 },
      { id: 'c', weight: 135, reps: 5, count: 3 },
      { id: 'd', weight: 95, reps: 10 },
      { id: 'e', weight: 135, reps: 5, count: 0 },
    ]

    it('leaves the input array and every line inside it untouched', () => {
      const sets: WorkoutSet[] = inputMatrix.map((line) => ({ ...line }))
      const before = JSON.stringify(sets)

      collapseDuplicateSets(sets)

      expect(JSON.stringify(sets)).toBe(before)
    })

    it('leaves the input array unsorted and unreordered by the call', () => {
      const sets: WorkoutSet[] = inputMatrix.map((line) => ({ ...line }))
      const idsBefore = sets.map((line) => line.id)

      collapseDuplicateSets(sets)

      expect(sets.map((line) => line.id)).toEqual(idsBefore)
    })

    it('returns a new array rather than the one it was handed', () => {
      const sets: WorkoutSet[] = inputMatrix.map((line) => ({ ...line }))

      expect(collapseDuplicateSets(sets)).not.toBe(sets)
    })

    it('returns new line objects so mutating them cannot reach the caller array', () => {
      const sets: WorkoutSet[] = inputMatrix.map((line) => ({ ...line }))

      const result = collapseDuplicateSets(sets)
      result.forEach((line) => {
        expect(sets.includes(line)).toBe(false)
      })
    })
  })
})
