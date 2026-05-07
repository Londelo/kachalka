import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, sql, desc } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'
import { and } from 'drizzle-orm'
import * as R from 'ramda'

function mapRowToWorkoutLog(row: Record<string, unknown>): WorkoutLog {
  return {
    id: { value: Number(row.id) },
    userId: Number(row.userId),
    exerciseId: Number(row.exerciseId),
    date: row.date as string,
    sets: JSON.parse(row.sets as string) as WorkoutSet[],
    createdAt: row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? (row.updated_at as Date).toISOString() : String(row.updated_at),
  }
}

export function createSqliteWorkoutRepository(db: ReturnType<typeof Database>): WorkoutRepository {
  const queryDb = drizzle(db, { schema })

  return {
    findById(id: number): WorkoutLog | undefined {
      const row = queryDb
        .select()
        .from(schema.workoutLogs)
        .where(eq(schema.workoutLogs.id, id))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToWorkoutLog(row)
    },

    create(log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>): WorkoutLog {
      const inserted = queryDb
        .insert(schema.workoutLogs)
        .values({
          userId: log.userId,
          exerciseId: log.exerciseId,
          date: log.date,
          sets: JSON.stringify(log.sets),
        })
        .returning({
          id: schema.workoutLogs.id,
          userId: schema.workoutLogs.userId,
          exerciseId: schema.workoutLogs.exerciseId,
          date: schema.workoutLogs.date,
          sets: schema.workoutLogs.sets,
          createdAt: schema.workoutLogs.createdAt,
          updatedAt: schema.workoutLogs.updatedAt,
        })
        .get()

      return mapRowToWorkoutLog(inserted)
    },

    findByDateAndExercise(userId: number, date: string, exerciseId: number): WorkoutLog | undefined {
      const row = queryDb
        .select()
        .from(schema.workoutLogs)
        .where(and(
          eq(schema.workoutLogs.userId, userId),
          eq(schema.workoutLogs.date, date),
          eq(schema.workoutLogs.exerciseId, exerciseId),
        ))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToWorkoutLog(row)
    },

    findByDate(userId: number, date: string): WorkoutLog[] {
      const rows = queryDb
        .select()
        .from(schema.workoutLogs)
        .where(and(
          eq(schema.workoutLogs.userId, userId),
          eq(schema.workoutLogs.date, date),
        ))
        .all()

      return R.map(mapRowToWorkoutLog, rows)
    },

    findAllByUser(userId: number): WorkoutLog[] {
      const rows = queryDb
        .select()
        .from(schema.workoutLogs)
        .where(eq(schema.workoutLogs.userId, userId))
        .all()

      return R.map(mapRowToWorkoutLog, rows)
    },

    update(id: number, sets: WorkoutSet[]): WorkoutLog | undefined {
      const updated = queryDb
        .update(schema.workoutLogs)
        .set({ sets: JSON.stringify(sets) })
        .where(eq(schema.workoutLogs.id, id))
        .returning({
          id: schema.workoutLogs.id,
          userId: schema.workoutLogs.userId,
          exerciseId: schema.workoutLogs.exerciseId,
          date: schema.workoutLogs.date,
          sets: schema.workoutLogs.sets,
          createdAt: schema.workoutLogs.createdAt,
          updatedAt: schema.workoutLogs.updatedAt,
        })
        .get()

      if (!updated) return undefined
      return mapRowToWorkoutLog(updated)
    },

    delete(id: number): void {
      queryDb
        .delete(schema.workoutLogs)
        .where(eq(schema.workoutLogs.id, id))
        .run()
    },

    findByDayOfWeek(userId: number, dayOfWeek: number): { exerciseId: number; exerciseName: string; lastLog?: WorkoutLog }[] {
      const routineRows = queryDb
        .select({
          exerciseId: schema.userRoutines.exerciseId,
        })
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.dayOfWeek, dayOfWeek))
        .all()

      if (R.isEmpty(routineRows)) {
        return []
      }

      const exerciseIds: number[] = R.map((r: Record<string, unknown>) => Number(r.exerciseId), routineRows)

      const exerciseRows = queryDb
        .select({
          id: schema.exercises.id,
          name: schema.exercises.name,
        })
        .from(schema.exercises)
        .where(sql`${schema.exercises.id} IN (${sql.join(exerciseIds.map(String), sql`, `)})`)
        .all()

      const exerciseMap: Record<number, string> = {}
      for (const ex of exerciseRows) {
        exerciseMap[Number(ex.id)] = ex.name as string
      }

      const results: { exerciseId: number; exerciseName: string; lastLog?: WorkoutLog }[] = []

      for (const exId of exerciseIds) {
        const row = queryDb
          .select()
          .from(schema.workoutLogs)
          .where(
            and(
              eq(schema.workoutLogs.userId, userId),
              eq(schema.workoutLogs.exerciseId, exId),
            ),
          )
          .orderBy(desc(schema.workoutLogs.date))
          .limit(1)
          .get()

        const lastLog = row ? mapRowToWorkoutLog(row) : undefined

        results.push({
          exerciseId: exId,
          exerciseName: exerciseMap[exId] || 'UNKNOWN',
          lastLog,
        })
      }

      return results
    },
  }
}
