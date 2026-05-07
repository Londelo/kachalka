'use server'

import { getDatabase } from '@/config/db'
import { SqliteChartRepository } from '@/features/chart/chart-repo-impl'
import { ChartService } from '@/features/chart/chart-service'
import type { ChartDataPoint, IntensitySplit } from '@/features/chart/chart-entity'

export async function getExerciseChartData(
  userId: number,
  exerciseId: number,
  range?: '1M' | '3M' | '6M' | 'ALL',
): Promise<ChartDataPoint[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getExerciseProgress(userId, exerciseId, range)
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
  exerciseId: number,
): Promise<number> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getPeakVolume(userId, exerciseId)
}

export async function getIntensitySplitAction(
  userId: number,
  exerciseId: number,
): Promise<IntensitySplit[]> {
  const repo = new SqliteChartRepository(getDatabase())
  const service = new ChartService(repo)
  return service.getIntensitySplit(userId, exerciseId)
}
