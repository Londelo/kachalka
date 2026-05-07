export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'

const DAY_TO_NUMBER: Record<DayOfWeek, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

const NUMBER_TO_DAY: Record<number, DayOfWeek> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
}

export function dayOfWeekToNumber(day: DayOfWeek): number {
  const num = DAY_TO_NUMBER[day]
  if (num === undefined) {
    throw new Error(`Invalid day of week: ${day}`)
  }
  return num
}

export function numberToDayOfWeek(n: number): DayOfWeek {
  const day = NUMBER_TO_DAY[n]
  console.log('[TRACING] numberToDayOfWeek - input:', n, '-> output:', day)
  if (day === undefined) {
    throw new Error(`Invalid day number: ${n}`)
  }
  return day
}

export const RoutineId = Object.freeze({
  make(n: number): { value: number } {
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < 0
    ) {
      throw new Error(`RoutineId must be a non-negative integer, got: ${n}`)
    }
    return { value: n }
  },
})

export function createRoutineAssignment(
  userId: number,
  exerciseId: number,
  dayOfWeek: DayOfWeek,
): { id: { value: number }; userId: number; exerciseId: number; dayOfWeek: DayOfWeek } {
  if (
    typeof userId !== 'number' ||
    !Number.isInteger(userId) ||
    userId < 0
  ) {
    throw new Error('userId must be a non-negative integer')
  }

  if (
    typeof exerciseId !== 'number' ||
    !Number.isInteger(exerciseId) ||
    exerciseId < 0
  ) {
    throw new Error('exerciseId must be a non-negative integer')
  }

  dayOfWeekToNumber(dayOfWeek)

  return {
    id: { value: 0 },
    userId,
    exerciseId,
    dayOfWeek,
  }
}

export type RoutineAssignment = {
  id: { value: number }
  userId: number
  exerciseId: number
  dayOfWeek: DayOfWeek
}
