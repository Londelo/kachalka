import type { RoutineAssignment } from '@/features/routine/routine-entity'
import { DAY_NAMES, DAY_LABELS } from '@/features/routine/routine-entity'

type RoutineMap = Record<string, RoutineAssignment[]> | null

export { DAY_NAMES, DAY_LABELS }

export function getAssignmentsForDay(routine: RoutineMap, dayIndex: number): RoutineAssignment[] {
  if (!routine) return []
  const dayName = DAY_NAMES[dayIndex]
  return routine[dayName] ?? []
}

export function getDayLabel(dayIndex: number): string {
  return DAY_LABELS[dayIndex]
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
