'use server'

import { getDatabase } from '@/config/db'
import { SqliteChartRepository } from '@/features/chart/chart-repo-impl'
import { ChartService } from '@/features/chart/chart-service'
import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'

export async function getExerciseChartData(
  userId: number,
  exerciseId: number,
  range?: RangeFilter,
  granularity?: TimeGranularity,
): Promise<ChartDataPoint[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getExerciseProgress(userId, exerciseId, range, granularity)
}

export async function getAllExerciseChartData(
  userId: number,
  range?: RangeFilter,
  granularity?: TimeGranularity,
): Promise<ChartDataPoint[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getAllExercisesProgress(userId, range, granularity)
}

export async function getExercisesWithLogsAction(
  userId: number,
): Promise<{ id: number; name: string }[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getExercisesWithLogs(userId)
}

export async function getPeakVolumeAction(
  userId: number,
  exerciseId?: number | null,
): Promise<number> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getPeakVolume(userId, exerciseId)
}

export async function getIntensitySplitAction(
  userId: number,
  exerciseId?: number | null,
): Promise<IntensitySplit[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getIntensitySplit(userId, exerciseId)
}
