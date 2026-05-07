import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

export function deleteExerciseUseCase(repo: ExerciseRepository) {
  return {
    execute(exerciseId: number, userId: number): void {
      const exercise = repo.findById(exerciseId)

      if (!exercise) {
        throw new Error('Exercise not found')
      }

      if (exercise.ownerId.value !== userId) {
        throw new Error('Only the owner can delete this exercise')
      }

      if (repo.inAnyRoutine(exerciseId)) {
        throw new Error('Cannot delete exercise that is part of a routine')
      }

      repo.delete(exerciseId)
    },
  }
}
