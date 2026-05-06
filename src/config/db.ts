import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'

const dbPath = path.join(process.cwd(), 'data', 'kachalka.db')

let dbInstance: Database | null = null

export function getDatabase(): Database {
  if (!dbInstance) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    dbInstance = db
  }
  return dbInstance
}

export const db = drizzle(getDatabase(), { schema })
