import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { Exercise } from '@/features/exercise/exercise-entity'

export function listExercisesUseCase(repo: ExerciseRepository) {
  return {
    execute(): Exercise[] {
      return repo.findAll()
    },
  }
}
