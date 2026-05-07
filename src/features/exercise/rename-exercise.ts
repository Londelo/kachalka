import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { Exercise } from '@/features/exercise/exercise-entity'

export function renameExerciseUseCase(repo: ExerciseRepository) {
  return {
    execute(exerciseId: number, newName: string, userId: number): Exercise {
      const exercise = repo.findById(exerciseId)

      if (!exercise) {
        throw new Error('Exercise not found')
      }

      if (exercise.ownerId.value !== userId) {
        throw new Error('Only the owner can rename this exercise')
      }

      const trimmed = newName.trim()

      if (trimmed.length === 0) {
        throw new Error('Name cannot be empty')
      }

      if (trimmed.length > 100) {
        throw new Error('Name too long')
      }

      return repo.updateName(exerciseId, trimmed)!
    },
  }
}
