import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { UserRepository } from '@/features/user/user-repository'
import type { User } from '@/features/user/user-entity'
import { UserId } from '@/features/user/user-entity'
function mapRowToUser(row: Record<string, unknown>): User | null {
  const id = row.id
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
    return null
  }
  const name = row.name
  if (typeof name !== 'string' || name.length === 0) {
    return null
  }
  return {
    id: UserId.make(id),
    name,
  }
}

export function createSqliteUserRepository(db: ReturnType<typeof Database>): UserRepository {
  const queryDb = drizzle(db, { schema })

  return {
    findById(id: number): User | undefined {
      const row = queryDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToUser(row) ?? undefined
    },

    findByName(name: string): User | undefined {
      const row = queryDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.name, name))
        .limit(1)
        .get()

      if (!row) return undefined
      return mapRowToUser(row) ?? undefined
    },

    findAll(): User[] {
      const rows = queryDb
        .select()
        .from(schema.users)
        .orderBy(schema.users.name)
        .all()

      return rows.map(mapRowToUser).filter((u): u is User => u !== null)
    },

    create(user: User): User {
      const inserted = queryDb
        .insert(schema.users)
        .values({ name: user.name })
        .returning({ id: schema.users.id, name: schema.users.name })
        .get()

      return {
        id: UserId.make(inserted.id),
        name: inserted.name,
      }
    },

    delete(id: number): void {
      // Cascade delete: remove all related records before deleting the user.
      queryDb.delete(schema.workoutLogs).where(eq(schema.workoutLogs.userId, id)).run()
      queryDb.delete(schema.userRoutines).where(eq(schema.userRoutines.userId, id)).run()
      queryDb.delete(schema.exercises).where(eq(schema.exercises.userId, id)).run()
      queryDb.delete(schema.users).where(eq(schema.users.id, id)).run()
    },
  }
}
