import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'
import type { Exercise } from '@/features/exercise/exercise-entity'
import { ExerciseId } from '@/features/exercise/exercise-entity'
import * as R from 'ramda'

function mapRowToExercise(row: Record<string, unknown>): Exercise {
  return {
    id: ExerciseId.make(row.id as number),
    name: row.name as string,
    ownerId: ExerciseId.make(row.userId as number),
  }
}

export function createSqliteExerciseRepository(db: ReturnType<typeof Database>): ExerciseRepository {
  const queryDb = drizzle(db, { schema })

  return {
    findById(id: number): Exercise | undefined {
      const row = queryDb
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.id, id))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToExercise(row)
    },

    findByName(name: string): Exercise | undefined {
      const row = queryDb
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.name, name))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToExercise(row)
    },

    findAll(): Exercise[] {
      const rows = queryDb
        .select()
        .from(schema.exercises)
        .orderBy(schema.exercises.name)
        .all()

      return R.map(mapRowToExercise, rows)
    },

    create(exercise: Exercise): Exercise {
      const inserted = queryDb
        .insert(schema.exercises)
        .values({ name: exercise.name, userId: exercise.ownerId.value })
        .returning({ id: schema.exercises.id, name: schema.exercises.name, userId: schema.exercises.userId })
        .get()

      return {
        id: ExerciseId.make(inserted.id),
        name: inserted.name,
        ownerId: ExerciseId.make(inserted.userId),
      }
    },

    delete(id: number): void {
      queryDb
        .delete(schema.exercises)
        .where(eq(schema.exercises.id, id))
        .run()
    },

    updateName(id: number, name: string): Exercise | undefined {
      const updated = queryDb
        .update(schema.exercises)
        .set({ name })
        .where(eq(schema.exercises.id, id))
        .returning({ id: schema.exercises.id, name: schema.exercises.name, userId: schema.exercises.userId })
        .get()

      if (!updated) return undefined
      return {
        id: ExerciseId.make(updated.id),
        name: updated.name,
        ownerId: ExerciseId.make(updated.userId),
      }
    },

    findByOwner(userId: number): Exercise[] {
      const rows = queryDb
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.userId, userId))
        .orderBy(schema.exercises.name)
        .all()

      return R.map(mapRowToExercise, rows)
    },

    inAnyRoutine(id: number): boolean {
      const row = queryDb
        .select({ count: schema.userRoutines.id })
        .from(schema.userRoutines)
        .where(eq(schema.userRoutines.exerciseId, id))
        .limit(1)
        .get()

      return row !== undefined
    },
  }
}
