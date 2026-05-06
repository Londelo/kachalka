export function formatDate(date?: Date): string {
  if (!date) return ''
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodayISO(): string {
  return formatDate(new Date())
}

const DAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

export function dayOfWeekToIndex(day: string): number {
  if (!(day in DAY_INDEX)) {
    throw new Error(`Invalid day of week: ${day}`)
  }
  return DAY_INDEX[day]
}
