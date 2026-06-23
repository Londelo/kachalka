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

export function isDaySelected(selectedDay: number, checkDay: number): boolean {
  return selectedDay === checkDay
}
