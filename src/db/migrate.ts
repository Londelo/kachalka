import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '@/config/db'
import * as schema from '@/db/schema'

export async function runMigrations(db?: Database): Promise<void> {
  const instance = db ?? getDatabase()
  const dbInstance = instance as Database
  const drizzleDb = drizzle(dbInstance, { schema })

  try {
    await migrate(drizzleDb, {
      migrationsPath: 'src/db/migrations',
    })
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}
