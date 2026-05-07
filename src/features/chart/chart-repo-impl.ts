import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { ChartRepository } from '@/features/chart/chart-repository'
import type { ChartDataPoint, IntensitySplit } from '@/features/chart/chart-entity'
import type { WorkoutSet } from '@/features/workout/types'
import * as R from 'ramda'

function mapRowToDataPoint(row: Record<string, unknown>): ChartDataPoint {
  const sets = row.sets as WorkoutSet[]
  return {
    date: row.date as string,
    volume: R.sum(
      R.map(
        (s: WorkoutSet) => s.reps * s.weight,
        sets,
      ),
    ),
    sets,
  }
}

function applyDateFilter(
  logs: ChartDataPoint[],
  range: '1M' | '3M' | '6M' | 'ALL' | undefined,
): ChartDataPoint[] {
  if (range === 'ALL' || !range) {
    return logs
  }

  const days = R.cond([
    [R.equals('1M'), R.always(30)],
    [R.equals('3M'), R.always(90)],
    [R.equals('6M'), R.always(180)],
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
    exerciseId: number,
    range?: '1M' | '3M' | '6M' | 'ALL',
  ): ChartDataPoint[] {
    const rows = this.queryDb
      .select()
      .from(schema.workoutLogs)
      .where(and(
        eq(schema.workoutLogs.userId, userId),
        eq(schema.workoutLogs.exerciseId, exerciseId),
      ))
      .orderBy(schema.workoutLogs.date)
      .all()

    const dataPoints = R.map(mapRowToDataPoint, rows)
    return applyDateFilter(dataPoints, range)
  }

  getPeakVolume(userId: number, exerciseId: number): number {
    const rows = this.queryDb
      .select()
      .from(schema.workoutLogs)
      .where(and(
        eq(schema.workoutLogs.userId, userId),
        eq(schema.workoutLogs.exerciseId, exerciseId),
      ))
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
    exerciseId: number,
  ): IntensitySplit[] {
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
