import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { RoutineAssignment } from '@/features/routine/routine-entity'

export function getUserRoutineUseCase(repo: RoutineRepository) {
  return {
    execute(userId: number): Record<number, RoutineAssignment[]> {
      return repo.findAllByUserGroupedByDay(userId)
    },
  }
}
