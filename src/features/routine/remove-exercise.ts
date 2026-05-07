import type { RoutineRepository } from '@/features/routine/routine-repository'

export function removeExerciseUseCase(repo: RoutineRepository) {
  return {
    execute(assignmentId: number): void {
      if (!repo.exists(assignmentId)) {
        throw new Error('Routine assignment not found')
      }

      repo.delete(assignmentId)
    },
  }
}
