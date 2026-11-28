import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collapseSetDrafts } from '@/app/today/collapse-drafts'
import { createBlankSetDraft, toWorkoutSet } from '@/app/today/set-draft'
import type { SetDraft, SetDraftField } from '@/app/today/set-draft'
import { validateSet } from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

const rule = vi.hoisted(() => ({
  collapseSets: vi.fn<(sets: WorkoutSet[]) => WorkoutSet[]>(),
}))

vi.mock('@/features/workout/workout-entity', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/workout/workout-entity')>()
  return { ...actual, collapseSets: rule.collapseSets }
})

const draftWith = (
  numbers: Partial<Record<SetDraftField, number | null>> = {},
  raw: Partial<Record<SetDraftField, string>> = {},
): SetDraft => ({
  ...createBlankSetDraft(),
  ...numbers,
  raw: { weight: '', reps: '', count: '', ...raw },
})

const draft = (weight: number, reps: number, count: number | null): SetDraft =>
  draftWith(
    { weight, reps, count },
    { weight: String(weight), reps: String(reps), count: count === null ? '' : String(count) },
  )

/**
 * A faithful answer from the shared rule.
 *
 * `collapseSets` hands back one line per group wearing `id: first.id` — the id
 * of the line that opened that group (src/features/workout/workout-entity.ts:191).
 * `collapseSetDrafts` decides which row speaks for its group by looking each
 * row's own id up in that answer, so a fake that mints an id of its own is a
 * fake the function under test answers with nothing: the lookup misses, the
 * collapsed row is dropped, and the card comes back empty. Every line built
 * here is therefore built from a real input draft and wears that draft's id.
 *
 * `opensTheGroup` is the draft whose row opened the group — never a later row
 * of it, which is the other half of what the real rule guarantees.
 */
const ruleLine = (
  opensTheGroup: SetDraft,
  weight: number,
  reps: number,
  count: number,
): WorkoutSet => ({
  id: opensTheGroup.id,
  weight,
  reps,
  count,
})

const linesHandedToTheRule = (): WorkoutSet[] => {
  const calls = rule.collapseSets.mock.calls
  expect(calls).toHaveLength(1)
  return calls[0][0]
}

beforeEach(() => {
  rule.collapseSets.mockReset()
  rule.collapseSets.mockReturnValue([])
})

describe('collapseSetDrafts', () => {
  describe('handing the rows to the shared rule', () => {
    it('calls the shared rule exactly once, with every collapsible row in one array', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const third = draft(95, 10, 1)
      const halfFilled = draftWith({ reps: 8 }, { reps: '8' })

      collapseSetDrafts([first, halfFilled, second, third])

      expect(rule.collapseSets).toHaveBeenCalledTimes(1)
      const lines = linesHandedToTheRule()
      expect(Array.isArray(lines)).toBe(true)
      expect(lines).toHaveLength(3)
      expect(lines[0]).toEqual({ id: first.id, weight: 135, reps: 5, count: 3 })
      expect(lines[1]).toEqual({ id: second.id, weight: 135, reps: 5, count: 2 })
      expect(lines[2]).toEqual({ id: third.id, weight: 95, reps: 10, count: 1 })
    })

    it('omits the count key entirely for a row whose count was never filled in', () => {
      collapseSetDrafts([draft(135, 5, null), draft(135, 5, 2)])

      const lines = linesHandedToTheRule()
      expect('count' in lines[0]).toBe(false)
      expect(Object.keys(lines[0]).sort()).toEqual(['id', 'reps', 'weight'])
      expect(lines[0].count).toBeUndefined()
      expect('count' in lines[1]).toBe(true)
      expect(lines[1]).toHaveProperty('count', 2)
    })

    // Retired: "hands a count of zero over as the number it is, not as a blank".
    // 7041530 moved that decision upstream into isCollapsibleSetDraft
    // (src/app/today/set-draft.ts:51-56), which consults isCountBelowMinimum — so
    // the rule is never reached with a typed zero at all. The truth now is the
    // opposite claim, and it is the one worth pinning.
    it('keeps a row whose typed count is below the minimum out of the rule’s input entirely', () => {
      const first = draft(135, 5, 3)
      // Same weight and reps as `first` on purpose: were the door ever to reopen,
      // this row would join that group and the sum would swallow the digit.
      const typedZero = draft(135, 5, 0)
      const other = draft(95, 10, 1)

      collapseSetDrafts([first, typedZero, other])

      expect(linesHandedToTheRule()).toEqual([
        { id: first.id, weight: 135, reps: 5, count: 3 },
        { id: other.id, weight: 95, reps: 10, count: 1 },
      ])
    })

    it('hands the rows over in on-screen order instead of pre-grouping them', () => {
      collapseSetDrafts([draft(135, 5, 1), draft(95, 10, 1), draft(135, 5, 1)])

      expect(linesHandedToTheRule().map(line => [line.weight, line.reps])).toEqual([
        [135, 5],
        [95, 10],
        [135, 5],
      ])
    })

    it('hands the rule nothing but the rows it can take', () => {
      const noReps = draftWith({ weight: 135 }, { weight: '135' })
      const noWeight = draftWith({ reps: 5 }, { reps: '5' })
      const countOnly = draftWith({ count: 3 }, { count: '3' })
      const untouched = createBlankSetDraft()

      collapseSetDrafts([noReps, draft(135, 5, 3), noWeight, untouched, countOnly])

      expect(linesHandedToTheRule()).toEqual([
        { id: expect.any(String), weight: 135, reps: 5, count: 3 },
      ])
    })
  })

  describe('the rule’s answer, put back on screen', () => {
    it('returns nothing when there is nothing to collapse', () => {
      expect(collapseSetDrafts([])).toEqual([])
      expect(linesHandedToTheRule()).toEqual([])
    })

    // Each card is named row by row so the rule's answer can be built from the
    // rows themselves: the line for a group wears the id of the row that opened
    // it, exactly as collapseSets does. A group's later rows appear in `input`
    // and never in `ruleAnswer`, which is the half of the contract that makes
    // the id lookup meaningful.
    const [pairFirst, pairSecond] = [draft(135, 5, 3), draft(135, 5, 2)]
    const [tripleFirst, tripleSecond, tripleThird] = [
      draft(135, 5, 1),
      draft(135, 5, 1),
      draft(135, 5, 1),
    ]
    const [repsFirst, repsSecond] = [draft(135, 5, 3), draft(135, 8, 1)]
    const [weightFirst, weightSecond] = [draft(135, 5, 3), draft(225, 5, 1)]

    it.each([
      {
        name: 'two identical rows become one whose count is the sum',
        input: [pairFirst, pairSecond],
        ruleAnswer: [ruleLine(pairFirst, 135, 5, 5)],
        expected: [{ weight: 135, reps: 5, count: 5 }],
      },
      {
        name: 'three identical rows become one whose count is the sum',
        input: [tripleFirst, tripleSecond, tripleThird],
        ruleAnswer: [ruleLine(tripleFirst, 135, 5, 3)],
        expected: [{ weight: 135, reps: 5, count: 3 }],
      },
      {
        name: 'rows differing in reps stay two rows, in input order',
        input: [repsFirst, repsSecond],
        ruleAnswer: [ruleLine(repsFirst, 135, 5, 3), ruleLine(repsSecond, 135, 8, 1)],
        expected: [
          { weight: 135, reps: 5, count: 3 },
          { weight: 135, reps: 8, count: 1 },
        ],
      },
      {
        name: 'rows differing in weight stay two rows, in input order',
        input: [weightFirst, weightSecond],
        ruleAnswer: [ruleLine(weightFirst, 135, 5, 3), ruleLine(weightSecond, 225, 5, 1)],
        expected: [
          { weight: 135, reps: 5, count: 3 },
          { weight: 225, reps: 5, count: 1 },
        ],
      },
    ])('$name', ({ input, ruleAnswer, expected }) => {
      rule.collapseSets.mockReturnValue(ruleAnswer)

      const result = collapseSetDrafts(input)

      expect(result).toHaveLength(expected.length)
      expect(result.map(({ weight, reps, count }) => ({ weight, reps, count }))).toEqual(expected)
    })

    it('mirrors each collapsed number in the text the inputs display', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      rule.collapseSets.mockReturnValue([ruleLine(first, 135, 5, 5)])

      const [collapsed] = collapseSetDrafts([first, second])

      expect(collapsed?.raw).toEqual({ weight: '135', reps: '5', count: '5' })
      expect(typeof collapsed?.count).toBe('number')
    })

    it.each([
      { name: 'a count the domain reads up from zero', stored: 0, reads: 1 },
      { name: 'a count the domain floors', stored: 2.7, reads: 2 },
    ])(
      'takes the count from the domain even for $name',
      ({ stored, reads }) => {
        const only = draft(135, 5, 1)
        rule.collapseSets.mockReturnValue([ruleLine(only, 135, 5, stored)])

        const [collapsed] = collapseSetDrafts([only])

        expect(collapsed?.count).toBe(reads)
        expect(collapsed?.raw.count).toBe(String(reads))
      },
    )

    it('gives every returned draft its own non-empty id', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const third = draft(95, 10, 1)
      const untouched = createBlankSetDraft()
      // Identity is carried in, never minted: the shared rule echoes the first
      // line of each group, so each collapsed row wears the id of the input row
      // that survived it — `first` for the 135×5 group, `third` for the 95×10.
      rule.collapseSets.mockReturnValue([
        ruleLine(first, 135, 5, 5),
        ruleLine(third, 95, 10, 1),
      ])

      const result = collapseSetDrafts([first, second, third, untouched])

      const ids = result.map(row => row.id)
      ids.forEach(id => {
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
      })
      expect(new Set(ids).size).toBe(3)
      expect(ids).toEqual([first.id, third.id, untouched.id])
      expect(ids[2]).toBe(untouched.id)
    })
  })

  describe('the rows the rule cannot take', () => {
    // Nothing moves. A row the rule cannot take answers with itself and keeps
    // the position the lifter gave it (src/app/today/collapse-drafts.ts:66-71),
    // so the caret stays put instead of the row sliding to the bottom mid-word.
    // These cases therefore pin one untouched row per position on the card —
    // head, gap, tail — and the interleaved card pins all of them at once. Each
    // is a different reason the row is untakeable: no reps, no weight, nothing
    // at all, and a count the domain would refuse.
    it('keeps a row with no reps in the gap it was typed in, untouched', () => {
      const first = draft(135, 5, 3)
      const noReps = draftWith({ weight: 135, count: 4 }, { weight: '135', count: '4' })
      const second = draft(135, 5, 2)
      rule.collapseSets.mockReturnValue([ruleLine(first, 135, 5, 5)])

      const result = collapseSetDrafts([first, noReps, second])

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe(first.id)
      expect(result[0]?.raw).toEqual({ weight: '135', reps: '5', count: '5' })
      expect(result[1]).toBe(noReps)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('keeps a row with no weight at the head of the card, ahead of the collapsed row', () => {
      const noWeight = draftWith({ reps: 5, count: 4 }, { reps: '5', count: '4' })
      const only = draft(95, 10, 1)
      rule.collapseSets.mockReturnValue([ruleLine(only, 95, 10, 1)])

      const result = collapseSetDrafts([noWeight, only])

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(noWeight)
      expect(result[1]?.id).toBe(only.id)
      expect(result[1]?.raw).toEqual({ weight: '95', reps: '10', count: '1' })
      expect(linesHandedToTheRule()).toHaveLength(1)
    })

    it('keeps a fully blank row at the tail of the card, after the collapsed row', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const blank = createBlankSetDraft()
      rule.collapseSets.mockReturnValue([ruleLine(first, 135, 5, 5)])

      const result = collapseSetDrafts([first, second, blank])

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe(first.id)
      expect(result[1]).toBe(blank)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('keeps a row whose typed count is below the minimum in its own position, holding the digit', () => {
      const first = draft(135, 5, 3)
      const typedZero = draft(135, 5, 0)
      const other = draft(95, 10, 1)
      rule.collapseSets.mockReturnValue([
        ruleLine(first, 135, 5, 3),
        ruleLine(other, 95, 10, 1),
      ])

      const result = collapseSetDrafts([first, typedZero, other])

      expect(result).toHaveLength(3)
      expect(result[0]?.count).toBe(3)
      // The very same object, so the digit is the one that was typed: the fold
      // neither rewrote it nor folded it into `first`'s sum.
      expect(result[1]).toBe(typedZero)
      expect(result[1]?.raw.count).toBe('0')
      expect(result[2]?.count).toBe(1)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('keeps several untouched rows in the positions the lifter arranged them, around the collapsed row', () => {
      const blank = createBlankSetDraft()
      const first = draft(135, 5, 3)
      const halfFilled = draftWith({ reps: 8 }, { reps: '8' })
      const second = draft(135, 5, 2)
      const noWeight = draftWith({ reps: 3 }, { reps: '3' })
      rule.collapseSets.mockReturnValue([ruleLine(first, 135, 5, 5)])

      const result = collapseSetDrafts([blank, first, halfFilled, second, noWeight])

      expect(result).toHaveLength(4)
      expect(result[0]).toBe(blank)
      expect(result[1]?.id).toBe(first.id)
      expect(result[1]?.raw).toEqual({ weight: '135', reps: '5', count: '5' })
      expect(result[2]).toBe(halfFilled)
      expect(result[3]).toBe(noWeight)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('returns only the untouched rows when nothing can collapse', () => {
      const blank = createBlankSetDraft()
      const halfFilled = draftWith({ weight: 135 }, { weight: '135' })

      const result = collapseSetDrafts([blank, halfFilled])

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(blank)
      expect(result[1]).toBe(halfFilled)
      expect(linesHandedToTheRule()).toEqual([])
    })
  })

  describe('a row the fold refuses, on its way to the wire', () => {
    // The outbound half of the refusal. The fold once ate a typed `0`: the row
    // joined its group, the sum swallowed the digit, and `validateSet` never saw
    // a count worth refusing. These cases run the card through the same two
    // calls the save path makes in sequence — `saveable.map(toWorkoutSet)`
    // (src/app/today/page.tsx:490) and `validateSet(set, index + 1)`
    // (src/features/workout/log-workout.ts:16) — over what the fold handed back.
    // Should the fold ever start rewriting the digit again, the wire stops
    // carrying it and nothing here refuses anything.
    const saveTheCard = (drafts: SetDraft[]): WorkoutSet[] =>
      collapseSetDrafts(drafts).map(toWorkoutSet)

    const validateTheWire = (wire: WorkoutSet[]): void =>
      wire.forEach((set, index) => validateSet(set, index + 1))

    it('hands the typed 0 to the wire untouched and is refused by name with its line position', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const typedZero = draft(225, 8, 0)
      rule.collapseSets.mockReturnValue([ruleLine(first, 135, 5, 5)])

      const wire = saveTheCard([first, second, typedZero])

      expect(wire).toEqual([
        { id: first.id, reps: 5, weight: 135, count: 5 },
        { id: typedZero.id, reps: 8, weight: 225, count: 0 },
      ])
      // Line 2, never Line 3: the position the lifter is told is the position on
      // the collapsed card, and `second` left that card when its group folded.
      expect(() => validateTheWire(wire)).toThrow(/^Line 2: Set count must be at least 1/)
    })

    it('refuses nothing about the count when every row on the card carries one the domain accepts', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const blankCount = draft(95, 10, null)
      rule.collapseSets.mockReturnValue([
        ruleLine(first, 135, 5, 5),
        ruleLine(blankCount, 95, 10, 1),
      ])

      const wire = saveTheCard([first, second, blankCount])

      expect(wire).toEqual([
        { id: first.id, reps: 5, weight: 135, count: 5 },
        { id: blankCount.id, reps: 10, weight: 95, count: 1 },
      ])
      expect(() => validateTheWire(wire)).not.toThrow()
    })
  })

  describe('the input', () => {
    it('leaves the array and every draft in it exactly as it found them', () => {
      const rows = [
        draft(135, 5, 3),
        createBlankSetDraft(),
        draft(135, 5, 2),
        draftWith({ reps: 8 }, { reps: '8' }),
      ]
      const snapshot = JSON.parse(JSON.stringify(rows))
      const identities = rows.slice()
      rule.collapseSets.mockReturnValue([ruleLine(rows[0], 135, 5, 5)])

      const result = collapseSetDrafts(rows)

      expect(rows).toEqual(snapshot)
      expect(rows).toHaveLength(4)
      rows.forEach((row, index) => expect(row).toBe(identities[index]))
      expect(result).not.toBe(rows)
    })
  })
})
