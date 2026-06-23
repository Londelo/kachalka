import { describe, it, expect } from 'vitest'
import { formatDate, getTodayISO } from '@/shared/utils/date'

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
