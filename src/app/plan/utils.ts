import type { RoutineAssignment } from '@/features/routine/routine-entity'

type RoutineMap = Record<string, RoutineAssignment[]> | null

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export function getAssignmentsForDay(routine: RoutineMap, dayIndex: number): RoutineAssignment[] {
  if (!routine) return []
  const dayName = DAY_NAMES[dayIndex]
  return routine[dayName] ?? []
}

export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex]
}

export function getDayLabel(dayIndex: number): string {
  return DAY_LABELS[dayIndex]
}

export function hasAssignments(routine: RoutineMap, dayIndex: number): boolean {
  return getAssignmentsForDay(routine, dayIndex).length > 0
}

export function getExerciseCountPerDay(routine: RoutineMap): number[] {
  if (!routine) return [0, 0, 0, 0, 0, 0, 0]
  return DAY_NAMES.map((dayName) => (routine[dayName] ?? []).length)
}

export function getExerciseCountForDay(routine: RoutineMap, dayIndex: number): number {
  return getExerciseCountPerDay(routine)[dayIndex]
}

export function resolveDaySelection(
  currentSelectedDay: number,
  currentAddingDay: number | null,
  clickedDayIndex: number,
): { nextSelectedDay: number; nextAddingDay: number | null } {
  if (currentSelectedDay === clickedDayIndex && (currentAddingDay === null || currentAddingDay === clickedDayIndex)) {
    return { nextSelectedDay: clickedDayIndex, nextAddingDay: clickedDayIndex }
  }
  return { nextSelectedDay: clickedDayIndex, nextAddingDay: null }
}

export function isDaySelected(selectedDay: number, addingDay: number | null, checkDay: number): boolean {
  return selectedDay === checkDay && addingDay !== checkDay
}
