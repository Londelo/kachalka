import type { WorkoutRepository } from '@/features/workout/workout-repository'

export function deleteWorkoutUseCase(repo: WorkoutRepository) {
  return {
    execute(logId: number, userId: number): void {
      const log = repo.findById(logId)

      if (!log) {
        throw new Error('Workout log not found')
      }

      if (log.userId !== userId) {
        throw new Error('Only the owner can delete this workout log')
      }

      repo.delete(logId)
    },
  }
}
