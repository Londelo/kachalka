import { describe, it, expect } from 'vitest'
import { buildPastSessionLines } from '@/app/today/past-session-lines'
import type { PastSessionSourceLine } from '@/app/today/past-session-lines'

const BenchLine: PastSessionSourceLine = { weight: 135, reps: 5, count: 2 }
const SquatLine: PastSessionSourceLine = { weight: 225, reps: 3, count: 1 }
const BlankLine: PastSessionSourceLine = { weight: 0, reps: 0, count: 1 }

function asLine(figure: unknown): PastSessionSourceLine {
  return figure as PastSessionSourceLine
}

describe('buildPastSessionLines', () => {
  const absentInputs: { label: string; input: PastSessionSourceLine[] | null | undefined }[] = [
    { label: 'previous session is null', input: null },
    { label: 'previous session is undefined', input: undefined },
    { label: 'previous session is an empty array', input: [] },
  ]

  it.each(absentInputs)('returns no rows when the $label', ({ input }) => {
    expect(buildPastSessionLines(input)).toEqual([])
  })

  it('passes a single line through carrying its own count', () => {
    expect(buildPastSessionLines([{ weight: 135, reps: 5, count: 3 }])).toEqual([
      { weight: 135, reps: 5, count: 3 },
    ])
  })

  it('returns exactly one row whose only keys are weight, reps and count', () => {
    const rows = buildPastSessionLines([{ weight: 135, reps: 5, count: 3 }])

    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]).sort()).toEqual(['count', 'reps', 'weight'])
  })

  it('hands a line with no count key to the shared rule and returns that rule’s missing-count value untouched', () => {
    expect(buildPastSessionLines([{ weight: 135, reps: 5 }])).toEqual([
      { weight: 135, reps: 5, count: 1 },
    ])
  })

  it('hands a zero count to the shared rule and returns that rule’s zero value rather than a default set here', () => {
    expect(buildPastSessionLines([{ weight: 135, reps: 5, count: 0 }])).toEqual([
      { weight: 135, reps: 5, count: 1 },
    ])
  })

  it('hands a fractional count to the shared rule and returns that rule’s fractional value rather than a floor taken here', () => {
    expect(buildPastSessionLines([{ weight: 135, reps: 5, count: 2.7 }])).toEqual([
      { weight: 135, reps: 5, count: 2 },
    ])
  })

  it('folds two matching lines into one row carrying the summed count', () => {
    expect(
      buildPastSessionLines([
        { weight: 135, reps: 5, count: 2 },
        { weight: 135, reps: 5, count: 3 },
      ]),
    ).toEqual([{ weight: 135, reps: 5, count: 5 }])
  })

  it('folds three matching lines into one row carrying the summed count', () => {
    expect(
      buildPastSessionLines([
        { weight: 135, reps: 5, count: 1 },
        { weight: 135, reps: 5, count: 2 },
        { weight: 135, reps: 5, count: 3 },
      ]),
    ).toEqual([{ weight: 135, reps: 5, count: 6 }])
  })

  it('keeps distinct lines distinct in the order they first appeared', () => {
    expect(buildPastSessionLines([BenchLine, SquatLine])).toEqual([
      { weight: 135, reps: 5, count: 2 },
      { weight: 225, reps: 3, count: 1 },
    ])
  })

  it('folds non-adjacent matching lines into one row and leaves the first-seen pair in front', () => {
    expect(
      buildPastSessionLines([
        { weight: 135, reps: 5, count: 1 },
        { weight: 225, reps: 3, count: 1 },
        { weight: 135, reps: 5, count: 2 },
      ]),
    ).toEqual([
      { weight: 135, reps: 5, count: 3 },
      { weight: 225, reps: 3, count: 1 },
    ])
  })

  it('drops the line that carries no figures at all', () => {
    expect(buildPastSessionLines([BlankLine])).toEqual([])
  })

  it('drops the blank line and keeps the line logged beside it', () => {
    expect(buildPastSessionLines([{ weight: 0, reps: 0 }, BenchLine])).toEqual([
      { weight: 135, reps: 5, count: 2 },
    ])
  })

  it('keeps a zero weight beside real reps, because only both-zero is blank', () => {
    expect(buildPastSessionLines([{ weight: 0, reps: 5, count: 1 }])).toEqual([
      { weight: 0, reps: 5, count: 1 },
    ])
  })

  it('keeps a zero reps beside real weight, because only both-zero is blank', () => {
    expect(buildPastSessionLines([{ weight: 135, reps: 0, count: 1 }])).toEqual([
      { weight: 135, reps: 0, count: 1 },
    ])
  })

  it('returns no rows when every stored line is blank, which is what drives the empty state', () => {
    expect(
      buildPastSessionLines([
        { weight: 0, reps: 0, count: 1 },
        { weight: 0, reps: 0, count: 4 },
      ]),
    ).toEqual([])
  })

  const unusableLines: { label: string; line: PastSessionSourceLine }[] = [
    { label: 'NaN weight', line: asLine({ weight: NaN, reps: 5, count: 1 }) },
    { label: 'Infinity reps', line: asLine({ weight: 135, reps: Infinity, count: 1 }) },
    { label: '-Infinity reps', line: asLine({ weight: 135, reps: -Infinity, count: 1 }) },
    { label: 'undefined weight', line: asLine({ weight: undefined, reps: 5, count: 1 }) },
    { label: 'string weight', line: asLine({ weight: '135', reps: 5, count: 1 }) },
  ]

  it.each(unusableLines)('drops the line carrying an unusable $label', ({ line }) => {
    expect(buildPastSessionLines([line])).toEqual([])
  })

  it('reads a frozen array of frozen lines without throwing and returns the expected rows', () => {
    const frozenInput = Object.freeze([
      Object.freeze({ weight: 135, reps: 5, count: 2 }),
      Object.freeze({ weight: 135, reps: 5, count: 3 }),
      Object.freeze({ weight: 0, reps: 0, count: 1 }),
    ]) as PastSessionSourceLine[]

    expect(() => buildPastSessionLines(frozenInput)).not.toThrow()
    expect(buildPastSessionLines(frozenInput)).toEqual([{ weight: 135, reps: 5, count: 5 }])
  })

  it('strips keys beyond the three figures off the row it returns', () => {
    const rows = buildPastSessionLines([
      asLine({ weight: 135, reps: 5, count: 3, id: 'abc', note: 'heavy' }),
    ])

    expect(rows).toEqual([{ weight: 135, reps: 5, count: 3 }])
    expect(Object.keys(rows[0]).sort()).toEqual(['count', 'reps', 'weight'])
  })
})
