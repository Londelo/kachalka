import type { ChartRepository } from '@/features/chart/chart-repository'
import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'

type ExerciseInfo = { id: number; name: string }

export class ChartService {
  private readonly repo: ChartRepository

  constructor(repo: ChartRepository) {
    this.repo = repo
  }

  getExerciseProgress(
    userId: number,
    exerciseId: number,
    range?: RangeFilter,
    granularity?: TimeGranularity,
  ): ChartDataPoint[] {
    return this.repo.getVolumeByDate(userId, exerciseId, range, granularity)
  }

  getAllExercisesProgress(
    userId: number,
    range?: RangeFilter,
    granularity?: TimeGranularity,
  ): ChartDataPoint[] {
    return this.repo.getVolumeByDate(userId, null, range, granularity)
  }

  getPeakVolume(userId: number, exerciseId?: number | null): number {
    return this.repo.getPeakVolume(userId, exerciseId)
  }

  getIntensitySplit(userId: number, exerciseId?: number | null): IntensitySplit[] {
    return this.repo.getIntensitySplit(userId, exerciseId)
  }

  getExercisesWithLogs(userId: number): ExerciseInfo[] {
    return this.repo.getExercisesWithLogs(userId)
  }
}
