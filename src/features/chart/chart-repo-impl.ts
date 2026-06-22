import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { ChartRepository } from '@/features/chart/chart-repository'
import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'
import { groupByGranularity } from '@/features/chart/chart-utils'
import type { WorkoutSet } from '@/features/workout/types'

export function mapRowToDataPoint(row: Record<string, unknown>): ChartDataPoint {
  const sets = row.sets as WorkoutSet[]
  const exerciseName = row.exerciseName as string
  return {
    date: row.date as string,
    volume: sets.reduce((t, s) => t + s.reps * s.weight, 0),
    sets,
    exercises: [{ name: exerciseName, sets }],
  }
}

function applyDateFilter(
  logs: ChartDataPoint[],
  range: RangeFilter | undefined,
): ChartDataPoint[] {
  if (range === 'ALL' || !range) {
    return logs
  }

  const days = range === '6M' ? 180 : range === '1Y' ? 365 : 0

  if (days === 0) {
    return logs
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  return logs.filter((dp: ChartDataPoint) => dp.date >= cutoffStr)
}

export function createSqliteChartRepository(db: ReturnType<typeof Database>): ChartRepository {
  const queryDb = drizzle(db, { schema })

  function getVolumeByDate(
    userId: number,
    exerciseId?: number | null,
    range?: RangeFilter,
    granularity?: TimeGranularity,
  ): ChartDataPoint[] {
    const whereClauses = [eq(schema.workoutLogs.userId, userId)]
    if (exerciseId != null) {
      whereClauses.push(eq(schema.workoutLogs.exerciseId, exerciseId))
    }

    const rows = queryDb
      .select({
        date: schema.workoutLogs.date,
        sets: schema.workoutLogs.sets,
        exerciseName: schema.exercises.name,
      })
      .from(schema.workoutLogs)
      .innerJoin(schema.exercises, eq(schema.workoutLogs.exerciseId, schema.exercises.id))
      .where(and(...whereClauses))
      .orderBy(schema.workoutLogs.date)
      .all()

    let dataPoints = rows.map(mapRowToDataPoint)
    dataPoints = applyDateFilter(dataPoints, range)

    if (granularity) {
      const grouped = groupByGranularity(dataPoints, granularity)
      return grouped.map(
        (bar) => ({
          date: bar.date,
          volume: bar.volume,
          sets: bar.tooltipData?.sets ?? [],
          exercises: bar.exercises,
        }),
      )
    }

    return dataPoints
  }

  function getPeakVolume(userId: number, exerciseId?: number | null): number {
    const whereClauses = [eq(schema.workoutLogs.userId, userId)]
    if (exerciseId != null) {
      whereClauses.push(eq(schema.workoutLogs.exerciseId, exerciseId))
    }

    const rows = queryDb
      .select()
      .from(schema.workoutLogs)
      .where(and(...whereClauses))
      .all()

    if (rows.length === 0) {
      return 0
    }

    const volumes = rows.map(
      (row: Record<string, unknown>) =>
        (row.sets as WorkoutSet[]).reduce((t, s) => t + s.reps * s.weight, 0),
    )

    return volumes.length > 0 ? Math.max(...volumes) : 0
  }

  function getIntensitySplit(
    userId: number,
    exerciseId?: number | null,
  ): IntensitySplit[] {
    if (exerciseId == null) {
      return []
    }

    const dataPoints = getVolumeByDate(userId, exerciseId, 'ALL')

    if (dataPoints.length === 0) {
      return []
    }

    const peakVolume = getPeakVolume(userId, exerciseId)
    const totalVolume = dataPoints.reduce((t, dp) => t + dp.volume, 0)

    if (totalVolume === 0) {
      return []
    }

    const topSetVolume = dataPoints.find(
      (dp: ChartDataPoint) => dp.volume === peakVolume,
    )?.volume ?? 0

    const volumeSetVolume = totalVolume - topSetVolume

    return [
      { type: 'TOP SET', percentage: Math.round((topSetVolume / totalVolume) * 100) },
      { type: 'VOLUME SET', percentage: Math.round((volumeSetVolume / totalVolume) * 100) },
    ]
  }

  function getExercisesWithLogs(userId: number): { id: number; name: string }[] {
    const rows = queryDb
      .select({
        id: schema.exercises.id,
        name: schema.exercises.name,
      })
      .from(schema.exercises)
      .where(
        inArray(
          schema.exercises.id,
          queryDb
            .select({ id: schema.workoutLogs.exerciseId })
            .from(schema.workoutLogs)
            .where(eq(schema.workoutLogs.userId, userId))
            .groupBy(schema.workoutLogs.exerciseId),
        ),
      )
      .orderBy(schema.exercises.name)
      .all()

    return rows.map(
      (row: Record<string, unknown>) => ({
        id: Number(row.id),
        name: row.name as string,
      }),
    )
  }

  return {
    getVolumeByDate,
    getPeakVolume,
    getIntensitySplit,
    getExercisesWithLogs,
  }
}
