import type { ChartRepository } from '@/features/chart/chart-repository'
import type { ChartDataPoint, IntensitySplit } from '@/features/chart/chart-entity'

type ExerciseInfo = { id: number; name: string }

export class ChartService {
  private readonly repo: ChartRepository

  constructor(repo: ChartRepository) {
    this.repo = repo
  }

  getExerciseProgress(
    userId: number,
    exerciseId: number,
    range?: '1M' | '3M' | '6M' | 'ALL',
  ): ChartDataPoint[] {
    return this.repo.getVolumeByDate(userId, exerciseId, range)
  }

  getPeakVolume(userId: number, exerciseId: number): number {
    return this.repo.getPeakVolume(userId, exerciseId)
  }

  getIntensitySplit(userId: number, exerciseId: number): IntensitySplit[] {
    return this.repo.getIntensitySplit(userId, exerciseId)
  }

  getExercisesWithLogs(userId: number): ExerciseInfo[] {
    return this.repo.getExercisesWithLogs(userId)
  }
}
