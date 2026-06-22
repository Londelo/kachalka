'use server'

import { getDatabase } from '@/config/db'
import { createSqliteChartRepository } from '@/features/chart/chart-repo-impl'
import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'

export async function getExerciseChartData(
  userId: number,
  exerciseId: number,
  range?: RangeFilter,
  granularity?: TimeGranularity,
): Promise<ChartDataPoint[]> {
  const repo = createSqliteChartRepository(getDatabase())
  return repo.getVolumeByDate(userId, exerciseId, range, granularity)
}

export async function getAllExerciseChartData(
  userId: number,
  range?: RangeFilter,
  granularity?: TimeGranularity,
): Promise<ChartDataPoint[]> {
  const repo = createSqliteChartRepository(getDatabase())
  return repo.getVolumeByDate(userId, null, range, granularity)
}

export async function getExercisesWithLogsAction(
  userId: number,
): Promise<{ id: number; name: string }[]> {
  const repo = createSqliteChartRepository(getDatabase())
  return repo.getExercisesWithLogs(userId)
}

export async function getPeakVolumeAction(
  userId: number,
  exerciseId?: number | null,
): Promise<number> {
  const repo = createSqliteChartRepository(getDatabase())
  return repo.getPeakVolume(userId, exerciseId)
}

export async function getIntensitySplitAction(
  userId: number,
  exerciseId?: number | null,
): Promise<IntensitySplit[]> {
  const repo = createSqliteChartRepository(getDatabase())
  return repo.getIntensitySplit(userId, exerciseId)
}
