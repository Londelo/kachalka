import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutSet } from '@/features/workout/types'

export function getWorkoutHistoryUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number): {
      date: string
      logs: {
        id: number
        exerciseId: number
        exerciseName: string
        sets: WorkoutSet[]
        volume: number
      }[]
    }[] {
      return repo.findHistoryByDate(userId)
    },
  }
}
