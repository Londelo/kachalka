import { describe, it, expect } from 'vitest'
import {
  getAssignmentsForDay,
  getDayLabel,
  isDaySelected,
} from '@/app/plan/utils'
import type { RoutineAssignment } from '@/features/routine/routine-entity'

const MondayExercise: RoutineAssignment = {
  id: { value: 1 },
  userId: 1,
  exerciseId: 1,
  dayOfWeek: 'Monday',
}

const TuesdayExercise: RoutineAssignment = {
  id: { value: 2 },
  userId: 1,
  exerciseId: 2,
  dayOfWeek: 'Tuesday',
}

const routineWithMonday = { Monday: [MondayExercise] }
const routineWithMultiple = {
  Monday: [MondayExercise],
  Tuesday: [TuesdayExercise],
  Wednesday: [],
  Thursday: undefined as unknown as RoutineAssignment[],
  Friday: [],
  Saturday: [],
  Sunday: [],
}

describe('getAssignmentsForDay', () => {
  it('returns assignments for the given day', () => {
    expect(getAssignmentsForDay(routineWithMonday, 0)).toEqual([MondayExercise])
  })

  it('returns empty array when day has no assignments', () => {
    expect(getAssignmentsForDay(routineWithMultiple, 2)).toEqual([])
  })

  it('returns empty array for undefined day key', () => {
    expect(getAssignmentsForDay(routineWithMultiple, 3)).toEqual([])
  })

  it('returns empty array when routine is null', () => {
    expect(getAssignmentsForDay(null, 0)).toEqual([])
  })

  it('returns empty array when routine is undefined', () => {
    // @ts-expect-error testing undefined routine
    expect(getAssignmentsForDay(undefined, 0)).toEqual([])
  })

  it('returns correct assignments for each day of the week', () => {
    const routine = {
      Monday: [MondayExercise],
      Tuesday: [TuesdayExercise],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    }
    expect(getAssignmentsForDay(routine, 0)).toEqual([MondayExercise])
    expect(getAssignmentsForDay(routine, 1)).toEqual([TuesdayExercise])
    expect(getAssignmentsForDay(routine, 2)).toEqual([])
  })

  it('returns empty array for out-of-bounds day index', () => {
    expect(getAssignmentsForDay(routineWithMonday, -1)).toEqual([])
    expect(getAssignmentsForDay(routineWithMonday, 7)).toEqual([])
    expect(getAssignmentsForDay(routineWithMonday, 100)).toEqual([])
  })
})

describe('getDayLabel', () => {
  it('returns correct label for each valid day index', () => {
    expect(getDayLabel(0)).toBe('MON')
    expect(getDayLabel(1)).toBe('TUE')
    expect(getDayLabel(2)).toBe('WED')
    expect(getDayLabel(3)).toBe('THU')
    expect(getDayLabel(4)).toBe('FRI')
    expect(getDayLabel(5)).toBe('SAT')
    expect(getDayLabel(6)).toBe('SUN')
  })

  it('returns undefined for out-of-bounds indices', () => {
    expect(getDayLabel(-1)).toBeUndefined()
    expect(getDayLabel(7)).toBeUndefined()
  })
})

describe('isDaySelected', () => {
  it('returns true when day matches selected', () => {
    expect(isDaySelected(2, 2)).toBe(true)
    expect(isDaySelected(0, 0)).toBe(true)
  })

  it('returns false when day does not match selected', () => {
    expect(isDaySelected(0, 1)).toBe(false)
    expect(isDaySelected(3, 5)).toBe(false)
  })

  it('returns true for matching selected day', () => {
    expect(isDaySelected(5, 5)).toBe(true)
  })

  it('returns false for non-matching selected', () => {
    expect(isDaySelected(0, 6)).toBe(false)
  })
})
