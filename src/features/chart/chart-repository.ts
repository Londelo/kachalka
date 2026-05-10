import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'

export interface ChartRepository {
  getVolumeByDate(
    userId: number,
    exerciseId?: number | null,
    range?: RangeFilter,
    granularity?: TimeGranularity,
  ): ChartDataPoint[]
  getPeakVolume(userId: number, exerciseId?: number | null): number
  getIntensitySplit(
    userId: number,
    exerciseId?: number | null,
  ): IntensitySplit[]
  getExercisesWithLogs(userId: number): { id: number; name: string }[]
}
