import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatDate, getTodayISO, dayOfWeekToIndex } from '@/shared/utils/date'

describe('formatDate', () => {
  it('formats a Date object to YYYY-MM-DD string', () => {
    const date = new Date(2025, 0, 6) // Jan 6, 2025 (month is 0-indexed)
    const result = formatDate(date)

    expect(result).toBe('2025-01-06')
  })

  it('formats with zero-padded month and day', () => {
    const date = new Date(2025, 11, 1) // Dec 1, 2025
    const result = formatDate(date)

    expect(result).toBe('2025-12-01')
  })

  it('formats single-digit months correctly', () => {
    const date = new Date(2025, 2, 5) // Mar 5, 2025
    const result = formatDate(date)

    expect(result).toBe('2025-03-05')
  })

  it('formats single-digit days correctly', () => {
    const date = new Date(2025, 8, 9) // Sep 9, 2025
    const result = formatDate(date)

    expect(result).toBe('2025-09-09')
  })

  it('handles leap year dates', () => {
    const date = new Date(2024, 1, 29) // Feb 29, 2024 (leap year)
    const result = formatDate(date)

    expect(result).toBe('2024-02-29')
  })
})

describe('getTodayISO', () => {
  it('returns today\'s date in YYYY-MM-DD format', () => {
    const result = getTodayISO()

    // Should match the current date
    const today = new Date()
    const expected = formatDate(today)

    expect(result).toBe(expected)
  })

  it('returns a string', () => {
    const result = getTodayISO()

    expect(typeof result).toBe('string')
  })

  it('matches the regex pattern for YYYY-MM-DD', () => {
    const result = getTodayISO()

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('dayOfWeekToIndex', () => {
  it('returns 0 for Monday', () => {
    expect(dayOfWeekToIndex('Monday')).toBe(0)
  })

  it('returns 1 for Tuesday', () => {
    expect(dayOfWeekToIndex('Tuesday')).toBe(1)
  })

  it('returns 2 for Wednesday', () => {
    expect(dayOfWeekToIndex('Wednesday')).toBe(2)
  })

  it('returns 3 for Thursday', () => {
    expect(dayOfWeekToIndex('Thursday')).toBe(3)
  })

  it('returns 4 for Friday', () => {
    expect(dayOfWeekToIndex('Friday')).toBe(4)
  })

  it('returns 5 for Saturday', () => {
    expect(dayOfWeekToIndex('Saturday')).toBe(5)
  })

  it('returns 6 for Sunday', () => {
    expect(dayOfWeekToIndex('Sunday')).toBe(6)
  })

  describe('error handling', () => {
    it('throws for invalid day names', () => {
      expect(() => dayOfWeekToIndex('Funday')).toThrow()
    })

    it('throws for lowercase day names', () => {
      expect(() => dayOfWeekToIndex('monday')).toThrow()
    })

    it('throws for abbreviated day names', () => {
      expect(() => dayOfWeekToIndex('Mon')).toThrow()
    })

    it('throws for numeric input', () => {
      // @ts-expect-error - testing runtime behavior with wrong type
      expect(() => dayOfWeekToIndex(0)).toThrow()
    })

    it('throws for empty string', () => {
      expect(() => dayOfWeekToIndex('')).toThrow()
    })
  })
})
