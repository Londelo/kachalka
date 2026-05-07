import type { ChartDataPoint, IntensitySplit } from '@/features/chart/chart-entity'

export interface ChartRepository {
  getVolumeByDate(
    userId: number,
    exerciseId: number,
    range?: '1M' | '3M' | '6M' | 'ALL',
  ): ChartDataPoint[]
  getPeakVolume(userId: number, exerciseId: number): number
  getIntensitySplit(
    userId: number,
    exerciseId: number,
  ): IntensitySplit[]
  getExercisesWithLogs(userId: number): { id: number; name: string }[]
}
