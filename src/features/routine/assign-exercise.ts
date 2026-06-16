import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { RoutineAssignment, DayOfWeek } from '@/features/routine/routine-entity'
import { createRoutineAssignment, dayOfWeekToNumber } from '@/features/routine/routine-entity'

export function assignExerciseUseCase(repo: RoutineRepository) {
  return {
    execute(userId: number, exerciseId: number, dayOfWeek: DayOfWeek): RoutineAssignment {
      if (!repo.exerciseExists(exerciseId)) {
        throw new Error('Exercise not found')
      }

      const dayNumber = dayOfWeekToNumber(dayOfWeek)
      const existing = repo.findByUserExerciseAndDay(userId, exerciseId, dayNumber)

      if (existing) {
        throw new Error('This exercise is already assigned to this day')
      }

      const unsaved = createRoutineAssignment(userId, exerciseId, dayOfWeek)
      return repo.create(unsaved)
    },
  }
}
