import { describe, it, expect } from 'vitest'
import { RoutineId, createRoutineAssignment, dayOfWeekToNumber, numberToDayOfWeek } from './routine-entity'

describe('RoutineId', () => {
  describe('make', () => {
    it('creates a RoutineId from zero', () => {
      const id = RoutineId.make(0)
      expect(id).toEqual({ value: 0 })
    })

    it('creates a RoutineId from a positive integer', () => {
      const id = RoutineId.make(1)
      expect(id).toEqual({ value: 1 })
    })

    it('creates a RoutineId from a large integer', () => {
      const id = RoutineId.make(999999)
      expect(id).toEqual({ value: 999999 })
    })

    it('rejects negative numbers', () => {
      expect(() => RoutineId.make(-1)).toThrow()
    })

    it('rejects negative numbers beyond -1', () => {
      expect(() => RoutineId.make(-100)).toThrow()
    })

    it('rejects floats', () => {
      expect(() => RoutineId.make(1.5)).toThrow()
    })

    it('rejects strings', () => {
      expect(() => RoutineId.make('1' as unknown as number)).toThrow()
    })

    it('rejects null', () => {
      expect(() => RoutineId.make(null as unknown as number)).toThrow()
    })

    it('rejects undefined', () => {
      expect(() => RoutineId.make(undefined as unknown as number)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => RoutineId.make(NaN)).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => RoutineId.make(Infinity)).toThrow()
    })
  })
})

describe('createRoutineAssignment', () => {
  it('creates a valid unsaved assignment', () => {
    const assignment = createRoutineAssignment(1, 1, 'Monday')
    expect(assignment).toEqual({
      id: { value: 0 },
      userId: 1,
      exerciseId: 1,
      dayOfWeek: 'Monday',
    })
  })

  it('creates an assignment with Wednesday', () => {
    const assignment = createRoutineAssignment(5, 10, 'Wednesday')
    expect(assignment.userId).toBe(5)
    expect(assignment.exerciseId).toBe(10)
    expect(assignment.dayOfWeek).toBe('Wednesday')
  })

  it('creates an assignment with Sunday', () => {
    const assignment = createRoutineAssignment(1, 1, 'Sunday')
    expect(assignment.dayOfWeek).toBe('Sunday')
  })

  it('rejects negative userId', () => {
    expect(() => createRoutineAssignment(-1, 1, 'Monday')).toThrow()
  })

  it('accepts zero userId', () => {
    const assignment = createRoutineAssignment(0, 1, 'Monday')
    expect(assignment.userId).toBe(0)
  })

  it('rejects float userId', () => {
    expect(() => createRoutineAssignment(1.5, 1, 'Monday')).toThrow()
  })

  it('rejects string userId', () => {
    expect(() => createRoutineAssignment('1' as unknown as number, 1, 'Monday')).toThrow()
  })

  it('rejects negative exerciseId', () => {
    expect(() => createRoutineAssignment(1, -1, 'Monday')).toThrow()
  })

  it('accepts zero exerciseId', () => {
    const assignment = createRoutineAssignment(1, 0, 'Monday')
    expect(assignment.exerciseId).toBe(0)
  })

  it('rejects float exerciseId', () => {
    expect(() => createRoutineAssignment(1, 1.5, 'Monday')).toThrow()
  })

  it('rejects string exerciseId', () => {
    expect(() => createRoutineAssignment(1, '1' as unknown as number, 'Monday')).toThrow()
  })

  it('rejects invalid dayOfWeek', () => {
    expect(() => createRoutineAssignment(1, 1, 'NotADay' as any)).toThrow()
  })

  it('rejects empty string dayOfWeek', () => {
    expect(() => createRoutineAssignment(1, 1, '' as any)).toThrow()
  })
})

describe('dayOfWeekToNumber', () => {
  it('converts Monday to 0', () => {
    expect(dayOfWeekToNumber('Monday')).toBe(0)
  })

  it('converts Tuesday to 1', () => {
    expect(dayOfWeekToNumber('Tuesday')).toBe(1)
  })

  it('converts Wednesday to 2', () => {
    expect(dayOfWeekToNumber('Wednesday')).toBe(2)
  })

  it('converts Thursday to 3', () => {
    expect(dayOfWeekToNumber('Thursday')).toBe(3)
  })

  it('converts Friday to 4', () => {
    expect(dayOfWeekToNumber('Friday')).toBe(4)
  })

  it('converts Saturday to 5', () => {
    expect(dayOfWeekToNumber('Saturday')).toBe(5)
  })

  it('converts Sunday to 6', () => {
    expect(dayOfWeekToNumber('Sunday')).toBe(6)
  })
})

describe('numberToDayOfWeek', () => {
  it('converts 0 to Monday', () => {
    expect(numberToDayOfWeek(0)).toBe('Monday')
  })

  it('converts 3 to Thursday', () => {
    expect(numberToDayOfWeek(3)).toBe('Thursday')
  })

  it('converts 6 to Sunday', () => {
    expect(numberToDayOfWeek(6)).toBe('Sunday')
  })

  it('rejects negative numbers', () => {
    expect(() => numberToDayOfWeek(-1)).toThrow()
  })

  it('rejects numbers beyond 6', () => {
    expect(() => numberToDayOfWeek(7)).toThrow()
  })

  it('rejects floats', () => {
    expect(() => numberToDayOfWeek(1.5)).toThrow()
  })
})
