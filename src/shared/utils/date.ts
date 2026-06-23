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

/** Convert Date.getDay() (Sun=0) to app index (Mon=0) */
export function jsDayToAppIndex(jsDay: number): number {
  return (jsDay - 1 + 7) % 7
}
