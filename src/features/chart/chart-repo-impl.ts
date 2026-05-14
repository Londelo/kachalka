import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { ChartRepository } from '@/features/chart/chart-repository'
import type { ChartDataPoint, IntensitySplit, RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'
import { groupByGranularity } from '@/features/chart/chart-utils'
import type { WorkoutSet } from '@/features/workout/types'
import * as R from 'ramda'

export function mapRowToDataPoint(row: Record<string, unknown>): ChartDataPoint {
  const sets = row.sets as WorkoutSet[]
  const exerciseName = row.exerciseName as string
  return {
    date: row.date as string,
    volume: R.sum(
      R.map(
        (s: WorkoutSet) => s.reps * s.weight,
        sets,
      ),
    ),
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

  const days = R.cond([
    [R.equals('6M'), R.always(180)],
    [R.equals('1Y'), R.always(365)],
    [R.T, R.always(0)],
  ])(range)

  if (days === 0) {
    return logs
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  return R.filter((dp: ChartDataPoint) => dp.date >= cutoffStr, logs)
}

export class SqliteChartRepository implements ChartRepository {
  private readonly queryDb: ReturnType<typeof drizzle>

  constructor(db: ReturnType<typeof Database>) {
    this.queryDb = drizzle(db, { schema })
  }

  getVolumeByDate(
    userId: number,
    exerciseId?: number | null,
    range?: RangeFilter,
    granularity?: TimeGranularity,
  ): ChartDataPoint[] {
    const whereClauses = [eq(schema.workoutLogs.userId, userId)]
    if (exerciseId != null) {
      whereClauses.push(eq(schema.workoutLogs.exerciseId, exerciseId))
    }

    const rows = this.queryDb
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

    let dataPoints = R.map(mapRowToDataPoint, rows)
    dataPoints = applyDateFilter(dataPoints, range)

    if (granularity) {
      const grouped = groupByGranularity(dataPoints, granularity)
      return R.map(
        (bar) => ({
          date: bar.date,
          volume: bar.volume,
          sets: bar.tooltipData?.sets ?? [],
          exercises: bar.exercises,
        }),
        grouped,
      )
    }

    return dataPoints
  }

  getPeakVolume(userId: number, exerciseId?: number | null): number {
    const whereClauses = [eq(schema.workoutLogs.userId, userId)]
    if (exerciseId != null) {
      whereClauses.push(eq(schema.workoutLogs.exerciseId, exerciseId))
    }

    const rows = this.queryDb
      .select()
      .from(schema.workoutLogs)
      .where(and(...whereClauses))
      .all()

    if (R.isEmpty(rows)) {
      return 0
    }

    const volumes = R.map(
      (row: Record<string, unknown>) =>
        R.sum(
          R.map(
            (s: WorkoutSet) => s.reps * s.weight,
            row.sets as WorkoutSet[],
          ),
        ),
      rows,
    )

    return volumes.length > 0 ? Math.max(...volumes) : 0
  }

  getIntensitySplit(
    userId: number,
    exerciseId?: number | null,
  ): IntensitySplit[] {
    if (exerciseId == null) {
      return []
    }

    const dataPoints = this.getVolumeByDate(userId, exerciseId, 'ALL')

    if (R.isEmpty(dataPoints)) {
      return []
    }

    const peakVolume = this.getPeakVolume(userId, exerciseId)
    const totalVolume = R.sum(R.map((dp: ChartDataPoint) => dp.volume, dataPoints))

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

  getExercisesWithLogs(userId: number): { id: number; name: string }[] {
    const rows = this.queryDb
      .select({
        id: schema.exercises.id,
        name: schema.exercises.name,
      })
      .from(schema.exercises)
      .where(
        inArray(
          schema.exercises.id,
          this.queryDb
            .select({ id: schema.workoutLogs.exerciseId })
            .from(schema.workoutLogs)
            .where(eq(schema.workoutLogs.userId, userId))
            .groupBy(schema.workoutLogs.exerciseId),
        ),
      )
      .orderBy(schema.exercises.name)
      .all()

    return R.map(
      (row: Record<string, unknown>) => ({
        id: Number(row.id),
        name: row.name as string,
      }),
      rows,
    )
  }
}
