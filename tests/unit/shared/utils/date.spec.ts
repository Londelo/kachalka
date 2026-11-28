import { describe, it, expect } from 'vitest'
import { formatDate, getTodayISO, getTodayLocalDate } from '@/shared/utils/date'

describe('formatDate', () => {
  it('formats a Date object to YYYY-MM-DD string', () => {
    const date = new Date(2025, 0, 6)
    const result = formatDate(date)

    expect(result).toBe('2025-01-06')
  })

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2025, 2, 5)
    const result = formatDate(date)

    expect(result).toBe('2025-03-05')
  })

  it('handles leap year dates', () => {
    const date = new Date(2024, 1, 29)
    const result = formatDate(date)

    expect(result).toBe('2024-02-29')
  })

  it('returns empty string for undefined input', () => {
    expect(formatDate(undefined as unknown as Date)).toBe('')
  })
})

describe('getTodayISO', () => {
  it('returns today\'s date in YYYY-MM-DD format', () => {
    const result = getTodayISO()
    const today = new Date()
    const expected = formatDate(today)

    expect(result).toBe(expected)
  })

  it('matches YYYY-MM-DD format', () => {
    const result = getTodayISO()

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

const localDayOf = (date: Date): string => {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

describe('getTodayLocalDate', () => {
  it.each([
    ['an ordinary mid-autumn day', () => new Date(2026, 10, 25), '2026-11-25'],
    ['a single-digit month and a single-digit day', () => new Date(2026, 0, 9), '2026-01-09'],
    ['a September single-digit month and day', () => new Date(2026, 8, 5), '2026-09-05'],
    ['a two-digit month and a two-digit day', () => new Date(2026, 11, 31), '2026-12-31'],
    ['a leap day', () => new Date(2024, 1, 29), '2024-02-29'],
  ])('renders %s as the local YYYY-MM-DD', (_label, makeDate, expected) => {
    expect(getTodayLocalDate(makeDate())).toBe(expected)
  })

  it('defaults to the current local day when called with no argument', () => {
    const expected = localDayOf(new Date())
    const result = getTodayLocalDate()

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe(expected)
  })

  it('returns the local day of a late-evening instant, read from that instant’s own local getters', () => {
    const date = new Date(2026, 10, 25, 23, 59, 59)

    expect(getTodayLocalDate(date)).toBe(localDayOf(date))
    expect(getTodayLocalDate(date)).toBe('2026-11-25')
  })

  it('returns the local day of an early-morning instant, read from that instant’s own local getters', () => {
    const date = new Date(2026, 10, 25, 0, 30, 0)

    expect(getTodayLocalDate(date)).toBe(localDayOf(date))
    expect(getTodayLocalDate(date)).toBe('2026-11-25')
  })

  it.each([0, 1, 5, 11, 13, 19, 22, 23])(
    'never drifts to a neighbouring day at local hour %i',
    (hour) => {
      const date = new Date(2026, 10, 25, hour, 30, 0)

      expect(getTodayLocalDate(date)).toBe('2026-11-25')
    },
  )

  it('leaves the UTC helpers untouched — getTodayISO still equals formatDate', () => {
    expect(getTodayISO()).toBe(formatDate(new Date()))
  })
})
