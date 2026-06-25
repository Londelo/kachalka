import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'

let dbInstance: ReturnType<typeof Database> | null = null
let dbPathValue: string | undefined

function getDbPath(): string {
  if (dbPathValue === undefined) {
    dbPathValue = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'kachalka.db')
  }
  return dbPathValue
}

export function resetDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  dbPathValue = undefined
}

export function getDatabase(): ReturnType<typeof Database> {
  if (!dbInstance) {
    const dbPath = getDbPath()
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    dbInstance = db
  }
  return dbInstance
}

export const db = drizzle(getDatabase(), { schema })
