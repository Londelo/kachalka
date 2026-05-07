import type { RoutineRepository } from '@/features/routine/routine-repository'

export function removeExerciseUseCase(repo: RoutineRepository) {
  return {
    execute(userId: number, assignmentId: number): void {
      const assignment = repo.findById(assignmentId)
      if (!assignment || assignment.userId !== userId) {
        throw new Error('Routine assignment not found')
      }

      repo.delete(assignmentId)
    },
  }
}
