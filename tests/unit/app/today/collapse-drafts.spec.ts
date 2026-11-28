import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collapseSetDrafts } from '@/app/today/collapse-drafts'
import { createBlankSetDraft } from '@/app/today/set-draft'
import type { SetDraft, SetDraftField } from '@/app/today/set-draft'
import type { WorkoutSet } from '@/features/workout/types'

const rule = vi.hoisted(() => ({
  collapseSets: vi.fn<(sets: WorkoutSet[]) => WorkoutSet[]>(),
}))

vi.mock('@/features/workout/workout-entity', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/workout/workout-entity')>()
  return { ...actual, collapseSets: rule.collapseSets }
})

const RULE_LINE_ID = 'the-rule-owns-this-id'

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

const ruleLine = (weight: number, reps: number, count: number): WorkoutSet => ({
  id: RULE_LINE_ID,
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

    it('hands a count of zero over as the number it is, not as a blank', () => {
      collapseSetDrafts([draft(135, 5, 0)])

      const lines = linesHandedToTheRule()
      expect('count' in lines[0]).toBe(true)
      expect(lines[0]).toEqual({ id: expect.any(String), weight: 135, reps: 5, count: 0 })
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

    it.each([
      {
        name: 'two identical rows become one whose count is the sum',
        input: [draft(135, 5, 3), draft(135, 5, 2)],
        ruleAnswer: [ruleLine(135, 5, 5)],
        expected: [{ weight: 135, reps: 5, count: 5 }],
      },
      {
        name: 'three identical rows become one whose count is the sum',
        input: [draft(135, 5, 1), draft(135, 5, 1), draft(135, 5, 1)],
        ruleAnswer: [ruleLine(135, 5, 3)],
        expected: [{ weight: 135, reps: 5, count: 3 }],
      },
      {
        name: 'rows differing in reps stay two rows, in input order',
        input: [draft(135, 5, 3), draft(135, 8, 1)],
        ruleAnswer: [ruleLine(135, 5, 3), ruleLine(135, 8, 1)],
        expected: [
          { weight: 135, reps: 5, count: 3 },
          { weight: 135, reps: 8, count: 1 },
        ],
      },
      {
        name: 'rows differing in weight stay two rows, in input order',
        input: [draft(135, 5, 3), draft(225, 5, 1)],
        ruleAnswer: [ruleLine(135, 5, 3), ruleLine(225, 5, 1)],
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
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5)])

      const [collapsed] = collapseSetDrafts([draft(135, 5, 3), draft(135, 5, 2)])

      expect(collapsed?.raw).toEqual({ weight: '135', reps: '5', count: '5' })
      expect(typeof collapsed?.count).toBe('number')
    })

    it.each([
      { name: 'a count the domain reads up from zero', stored: 0, reads: 1 },
      { name: 'a count the domain floors', stored: 2.7, reads: 2 },
    ])(
      'takes the count from the domain even for $name',
      ({ stored, reads }) => {
        rule.collapseSets.mockReturnValue([{ id: RULE_LINE_ID, weight: 135, reps: 5, count: stored }])

        const [collapsed] = collapseSetDrafts([draft(135, 5, 1)])

        expect(collapsed?.count).toBe(reads)
        expect(collapsed?.raw.count).toBe(String(reads))
      },
    )

    it('gives every returned draft its own non-empty id', () => {
      const first = draft(135, 5, 3)
      const second = draft(135, 5, 2)
      const untouched = createBlankSetDraft()
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5), ruleLine(95, 10, 1)])

      const result = collapseSetDrafts([first, second, untouched])

      const ids = result.map(row => row.id)
      ids.forEach(id => {
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
      })
      expect(new Set(ids).size).toBe(3)
      expect(ids.slice(0, 2)).not.toContain(RULE_LINE_ID)
      expect(ids.slice(0, 2)).not.toContain(first.id)
      expect(ids.slice(0, 2)).not.toContain(second.id)
      expect(ids[2]).toBe(untouched.id)
    })
  })

  describe('the rows the rule cannot take', () => {
    it('puts a row with no reps after the collapsed rows, untouched', () => {
      const noReps = draftWith({ weight: 135, count: 4 }, { weight: '135', count: '4' })
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5)])

      const result = collapseSetDrafts([draft(135, 5, 3), noReps, draft(135, 5, 2)])

      expect(result).toHaveLength(2)
      expect(result[1]).toBe(noReps)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('puts a row with no weight after the collapsed rows, untouched', () => {
      const noWeight = draftWith({ reps: 5, count: 4 }, { reps: '5', count: '4' })
      rule.collapseSets.mockReturnValue([ruleLine(95, 10, 1)])

      const result = collapseSetDrafts([noWeight, draft(95, 10, 1)])

      expect(result).toHaveLength(2)
      expect(result[1]).toBe(noWeight)
      expect(linesHandedToTheRule()).toHaveLength(1)
    })

    it('puts a fully blank row after the collapsed rows, untouched', () => {
      const blank = createBlankSetDraft()
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5)])

      const result = collapseSetDrafts([draft(135, 5, 3), blank, draft(135, 5, 2)])

      expect(result).toHaveLength(2)
      expect(result[1]).toBe(blank)
      expect(linesHandedToTheRule()).toHaveLength(2)
    })

    it('keeps several untouched rows in their own relative order after the collapsed ones', () => {
      const blank = createBlankSetDraft()
      const halfFilled = draftWith({ reps: 8 }, { reps: '8' })
      const noWeight = draftWith({ reps: 3 }, { reps: '3' })
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5)])

      const result = collapseSetDrafts([
        blank,
        draft(135, 5, 3),
        halfFilled,
        draft(135, 5, 2),
        noWeight,
      ])

      expect(result).toHaveLength(4)
      expect(result[0]?.raw).toEqual({ weight: '135', reps: '5', count: '5' })
      expect(result[1]).toBe(blank)
      expect(result[2]).toBe(halfFilled)
      expect(result[3]).toBe(noWeight)
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
      rule.collapseSets.mockReturnValue([ruleLine(135, 5, 5)])

      const result = collapseSetDrafts(rows)

      expect(rows).toEqual(snapshot)
      expect(rows).toHaveLength(4)
      rows.forEach((row, index) => expect(row).toBe(identities[index]))
      expect(result).not.toBe(rows)
    })
  })
})
