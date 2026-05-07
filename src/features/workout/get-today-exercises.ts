import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { RoutineAssignment } from '@/features/routine/routine-entity'
import { numberToDayOfWeek } from '@/features/routine/routine-entity'

export function getTodayExercisesUseCase(
  routineRepo: RoutineRepository,
  workoutRepo: WorkoutRepository,
  exerciseRepo: ExerciseRepository,
) {
  return {
    execute(userId: number, dayOfWeek: number): Array<{
      exerciseId: number
      exerciseName: string
      lastLog: { weight: number; reps: number } | null
    }> {
      const allAssignments = routineRepo.findAllByUser(userId)
      const todayDay = numberToDayOfWeek(dayOfWeek)

      const todayAssignments = allAssignments.filter(
        (a: RoutineAssignment) => a.dayOfWeek === todayDay,
      )

      return todayAssignments.map((assignment: RoutineAssignment) => {
        const exercise = exerciseRepo.findById(assignment.exerciseId)
        const lastLog = exercise
          ? workoutRepo.findLatestForExercise(userId, assignment.exerciseId)
          : null

        return {
          exerciseId: assignment.exerciseId,
          exerciseName: exercise?.name ?? 'UNKNOWN',
          lastLog: lastLog
            ? { weight: lastLog.sets[0]?.weight ?? 0, reps: lastLog.sets[0]?.reps ?? 0 }
            : null,
        }
      })
    },
  }
}
