import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

export type E2eDatabase = ReturnType<typeof Database>

const DATA_DIRECTORY = 'data'
const DATABASE_FILENAME = 'kachalka.db'
const MIGRATIONS_DIRECTORY = path.join('src', 'db', 'migrations')
const REQUIRED_TABLES = ['users', 'exercises', 'user_routines', 'workout_logs']
const WIPE_ORDER = ['workout_logs', 'user_routines', 'exercises', 'users']

export function openE2eDatabase(checkoutRoot: string = process.cwd()): E2eDatabase {
  const dbPath = path.join(path.resolve(checkoutRoot), DATA_DIRECTORY, DATABASE_FILENAME)

  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  } catch (error) {
    throw new Error(
      `Cannot create the end-to-end data directory "${path.dirname(dbPath)}": ` +
        `${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function existingTableNames(db: E2eDatabase): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

function migrationFiles(migrationsDir: string): string[] {
  let entries: string[]
  try {
    entries = fs.readdirSync(migrationsDir)
  } catch (error) {
    throw new Error(
      `Cannot read the migrations directory "${migrationsDir}": ` +
        `${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  const files = entries.filter((entry) => entry.endsWith('.sql')).sort()
  if (files.length === 0) {
    throw new Error(`No .sql migration files found in "${migrationsDir}"`)
  }
  return files
}

export function ensureSchema(db: E2eDatabase): void {
  const tableNames = existingTableNames(db)
  if (REQUIRED_TABLES.every((table) => tableNames.includes(table))) return

  // runMigrations() in src/db/migrate.ts is not imported: it falls back to the
  // app's own db singleton and resolves its migrations from the app's cwd. The
  // migrations are located from the checkout root here, never from this compiled
  // test file's directory, so a worktree checkout builds its own schema.
  const migrationsDir = path.join(path.resolve(process.cwd()), MIGRATIONS_DIRECTORY)

  for (const file of migrationFiles(migrationsDir)) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    try {
      db.exec(sql)
    } catch (error) {
      throw new Error(
        `Migration "${file}" from "${migrationsDir}" failed: ` +
          `${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }
}

export function wipeE2eData(db: E2eDatabase): void {
  for (const table of WIPE_ORDER) {
    try {
      db.exec(`DELETE FROM ${table}`)
    } catch (error) {
      throw new Error(
        `Cannot wipe "${table}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }
}
