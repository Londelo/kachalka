import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { getDatabase } from '@/config/db'

const REQUIRED_TABLES = ['users', 'exercises', 'user_routines', 'workout_logs']

export function runMigrations(db?: Database): void {
  const instance = db ?? getDatabase()
  const dbInstance = instance as Database

  const tables = dbInstance
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[]
  const tableNames = tables.map((t) => t.name)

  const needsMigration = REQUIRED_TABLES.some((t) => !tableNames.includes(t))
  if (!needsMigration) return

  const migrationsDir = path.join(process.cwd(), 'src', 'db', 'migrations')
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    try {
      dbInstance.exec(sql)
    } catch (error) {
      console.error(`Migration failed on ${file}:`, error)
      throw error
    }
  }
}
