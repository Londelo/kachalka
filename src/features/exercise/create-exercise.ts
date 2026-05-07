import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { Exercise } from '@/features/exercise/exercise-entity'
import { createExercise as validateExercise } from '@/features/exercise/exercise-entity'

export function createExerciseUseCase(repo: ExerciseRepository) {
  return {
    execute(name: string, ownerId: number): Exercise {
      const validated = validateExercise(name, ownerId)
      return repo.create(validated)
    },
  }
}
