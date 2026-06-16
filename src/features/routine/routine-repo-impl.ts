import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { RoutineRepository } from '@/features/routine/routine-repository'
import type { RoutineAssignment } from '@/features/routine/routine-entity'
import { RoutineId, numberToDayOfWeek, dayOfWeekToNumber } from '@/features/routine/routine-entity'
import { and } from 'drizzle-orm'
import * as R from 'ramda'

function mapRowToRoutineAssignment(row: Record<string, unknown>): RoutineAssignment {
  return {
    id: RoutineId.make(row.id as number),
    userId: row.userId as number,
    exerciseId: row.exerciseId as number,
    dayOfWeek: numberToDayOfWeek(row.dayOfWeek as number),
  }
}

export function createSqliteRoutineRepository(db: ReturnType<typeof Database>): RoutineRepository {
  const queryDb = drizzle(db, { schema })

  return {
    findById(id: number): RoutineAssignment | undefined {
      const row = queryDb
        .select()
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.id, id))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToRoutineAssignment(row)
    },

    findByUserAndDay(userId: number, dayOfWeek: number): RoutineAssignment | undefined {
      const row = queryDb
        .select()
        .from(schema.userRoutines)
        .where(and(eq(schema.userRoutines.userId, userId), eq(schema.userRoutines.dayOfWeek, dayOfWeek)))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToRoutineAssignment(row)
    },

    findByUserExerciseAndDay(userId: number, exerciseId: number, dayOfWeek: number): RoutineAssignment | undefined {
      const row = queryDb
        .select()
        .from(schema.userRoutines)
        .where(
          and(
            eq(schema.userRoutines.userId, userId),
            eq(schema.userRoutines.exerciseId, exerciseId),
            eq(schema.userRoutines.dayOfWeek, dayOfWeek),
          ),
        )
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToRoutineAssignment(row)
    },

    findAllByUser(userId: number): RoutineAssignment[] {
      const rows = queryDb
        .select()
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.userId, userId))
        .all()

      return R.map(mapRowToRoutineAssignment, rows)
    },

    findAllByUserGroupedByDay(userId: number): Record<string, RoutineAssignment[]> {
      const rows = queryDb
        .select()
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.userId, userId))
        .all()

      const assignments = R.map(mapRowToRoutineAssignment, rows)
      return R.groupBy(R.prop('dayOfWeek'), assignments)
    },

    create(assignment: RoutineAssignment): RoutineAssignment {
      const inserted = queryDb
        .insert(schema.userRoutines)
        .values({
          userId: assignment.userId,
          exerciseId: assignment.exerciseId,
          dayOfWeek: dayOfWeekToNumber(assignment.dayOfWeek),
        })
        .returning({
          id: schema.userRoutines.id,
          userId: schema.userRoutines.userId,
          exerciseId: schema.userRoutines.exerciseId,
          dayOfWeek: schema.userRoutines.dayOfWeek,
        })
        .get()

      return {
        id: RoutineId.make(inserted.id),
        userId: inserted.userId,
        exerciseId: inserted.exerciseId,
        dayOfWeek: numberToDayOfWeek(inserted.dayOfWeek),
      }
    },

    delete(id: number): void {
      queryDb
        .delete(schema.userRoutines)
        .where(eq(schema.userRoutines.id, id))
        .run()
    },

    exists(id: number): boolean {
      const row = queryDb
        .select({ count: schema.userRoutines.id })
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.id, id))
        .limit(1)
        .get()

      return row !== undefined
    },

    exerciseExists(id: number): boolean {
      const row = queryDb
        .select({ count: schema.exercises.id })
        .from(schema.exercises)
        .where(eq(schema.exercises.id, id))
        .limit(1)
        .get()

      return row !== undefined
    },
  }
}
