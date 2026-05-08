import type { WorkoutRepository } from '@/features/workout/workout-repository'
import { calculateVolume } from '@/features/workout/workout-entity'
import * as R from 'ramda'

export function getUserVolumeUseCase(repo: WorkoutRepository) {
  return {
    execute(userId: number): number {
      const logs = repo.findAllByUser(userId)
      return R.reduce(
        (total, log) => total + calculateVolume(log.sets),
        0,
        logs,
      )
    },
  }
}
