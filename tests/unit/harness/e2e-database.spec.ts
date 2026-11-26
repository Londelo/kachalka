import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const { getDatabaseMock } = vi.hoisted(() => ({ getDatabaseMock: vi.fn() }))

vi.mock('@/config/db', () => ({
  getDatabase: getDatabaseMock,
  resetDatabase: vi.fn(),
  db: {},
}))

import {
  openE2eDatabase,
  ensureSchema,
  wipeE2eData,
  type E2eDatabase,
} from '../../harness/e2e-database'

const REQUIRED_TABLES = ['users', 'exercises', 'user_routines', 'workout_logs']
const DATABASE_RELATIVE_PATH = path.join('data', 'kachalka.db')
const MIGRATIONS_RELATIVE_PATH = path.join('src', 'db', 'migrations')

const REPO_ROOT = process.cwd()

let root: string
let handles: E2eDatabase[]

function open(rootOverride: string = root): E2eDatabase {
  const db = openE2eDatabase(rootOverride)
  handles.push(db)
  return db
}

function openWithSchema(rootOverride: string = root): E2eDatabase {
  const db = open(rootOverride)
  ensureSchema(db)
  return db
}

function tableNames(db: E2eDatabase): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

function indexNames(db: E2eDatabase): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

function rowCount(db: E2eDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

function openedFile(db: E2eDatabase): string {
  const row = db.prepare('PRAGMA database_list').get() as { file: string }
  return row.file
}

function seedFullGraph(db: E2eDatabase): { userId: number; exerciseId: number } {
  const userId = Number(
    db
      .prepare('INSERT INTO users (name, created_at, is_active) VALUES (?, ?, ?)')
      .run('Commander', 1_700_000_000, 1).lastInsertRowid,
  )
  const exerciseId = Number(
    db
      .prepare(
        'INSERT INTO exercises (name, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run('Squat', userId, 1_700_000_000, 1_700_000_001).lastInsertRowid,
  )
  db.prepare(
    'INSERT INTO user_routines (user_id, exercise_id, day_of_week, created_at) VALUES (?, ?, ?, ?)',
  ).run(userId, exerciseId, 0, 1_700_000_000)
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, exerciseId, '2026-11-25', '[{"id":1,"reps":5,"weight":100}]', 1_700_000_000, 1_700_000_001)
  return { userId, exerciseId }
}

function seedRowsInOnlyOneTable(db: E2eDatabase, table: string): void {
  const statements: Record<string, string> = {
    users: "INSERT INTO users (id, name, created_at, is_active) VALUES (77, 'Lone Commander', 1700000000, 1)",
    exercises:
      "INSERT INTO exercises (id, name, user_id, created_at, updated_at) VALUES (77, 'Lone Squat', 77, 1700000000, 1700000000)",
    user_routines:
      'INSERT INTO user_routines (id, user_id, exercise_id, day_of_week, created_at) VALUES (77, 77, 77, 2, 1700000000)',
    workout_logs:
      "INSERT INTO workout_logs (id, user_id, exercise_id, date, sets, created_at, updated_at) VALUES (77, 77, 77, '2026-11-25', '[]', 1700000000, 1700000000)",
  }
  db.pragma('foreign_keys = OFF')
  db.exec(statements[table])
  db.pragma('foreign_keys = ON')
}

function writeMigrations(migrationsRoot: string, files: Record<string, string>): string {
  const migrationsDir = path.join(migrationsRoot, MIGRATIONS_RELATIVE_PATH)
  fs.mkdirSync(migrationsDir, { recursive: true })
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(migrationsDir, name), sql, 'utf-8')
  }
  return migrationsDir
}

function withCwd(nextCwd: string, body: () => void): void {
  const spy = vi.spyOn(process, 'cwd').mockReturnValue(nextCwd)
  try {
    body()
  } finally {
    spy.mockRestore()
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kachalka-e2e-db-'))
  handles = []
})

afterEach(() => {
  for (const db of handles) {
    if (db.open) db.close()
  }
  handles = []
  vi.restoreAllMocks()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('openE2eDatabase', () => {
  describe('the data directory', () => {
    it('creates the data directory when the root has none', () => {
      expect(fs.existsSync(path.join(root, 'data'))).toBe(false)

      open()

      expect(fs.existsSync(path.join(root, 'data'))).toBe(true)
    })

    it('creates the data directory and the database file together', () => {
      open()

      expect(fs.existsSync(path.join(root, DATABASE_RELATIVE_PATH))).toBe(true)
    })

    it('leaves an existing data directory alone', () => {
      const dataDir = path.join(root, 'data')
      fs.mkdirSync(dataDir, { recursive: true })
      const sentinel = path.join(dataDir, 'keep-me.txt')
      fs.writeFileSync(sentinel, 'untouched', 'utf-8')

      open()

      expect(fs.existsSync(sentinel)).toBe(true)
      expect(fs.readFileSync(sentinel, 'utf-8')).toBe('untouched')
    })

    it('leaves an existing database file alone rather than truncating it', () => {
      const first = openWithSchema()
      seedFullGraph(first)
      first.close()

      const second = open()

      expect(rowCount(second, 'users')).toBe(1)
    })

    it('throws naming the directory it could not create', () => {
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw new Error('read-only file system')
      })

      let caught: unknown
      try {
        open()
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain('Cannot create the end-to-end data directory')
      expect((caught as Error).message).toContain(path.join(root, 'data'))
      expect((caught as Error).message).toContain('read-only file system')
      expect((caught as Error).cause).toBeInstanceOf(Error)
    })

    it('coerces a non-Error failure from the directory creation into the message', () => {
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw 'permission denied'
      })

      expect(() => open()).toThrow('permission denied')
    })
  })

  describe('the returned handle', () => {
    it('answers a query', () => {
      const db = open()

      const row = db.prepare('SELECT 1 AS one').get() as { one: number }

      expect(row.one).toBe(1)
    })

    it('runs in WAL journal mode', () => {
      const db = open()

      const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }

      expect(row.journal_mode).toBe('wal')
    })

    it('has foreign keys enabled', () => {
      const db = open()

      const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }

      expect(row.foreign_keys).toBe(1)
    })
  })

  describe('the target file', () => {
    it('opens data/kachalka.db under the given root', () => {
      const db = open()

      expect(openedFile(db)).toBe(path.join(root, DATABASE_RELATIVE_PATH))
    })

    const rootSpellings = [
      { label: 'no trailing separator', suffix: '' },
      { label: 'one trailing separator', suffix: path.sep },
      { label: 'two trailing separators', suffix: path.sep + path.sep },
    ]

    it.each(rootSpellings)('resolves the same file when the root carries $label', ({ suffix }) => {
      const db = open(`${root}${suffix}`)

      expect(openedFile(db)).toBe(path.join(root, DATABASE_RELATIVE_PATH))
    })

    it('reads back through the trailing-separator root what the plain root wrote', () => {
      const writer = open()
      ensureSchema(writer)
      seedFullGraph(writer)

      const reader = open(`${root}${path.sep}`)

      expect(openedFile(reader)).toBe(openedFile(writer))
      expect(rowCount(reader, 'workout_logs')).toBe(1)
    })

    it('defaults the root to the current working directory', () => {
      withCwd(root, () => {
        const db = openE2eDatabase()
        handles.push(db)

        expect(openedFile(db)).toBe(path.join(root, DATABASE_RELATIVE_PATH))
      })
    })
  })

  describe('concurrent and repeated opening', () => {
    it('keeps two handles on one file both usable under WAL', () => {
      const writer = openWithSchema()
      const reader = open()

      seedFullGraph(writer)

      expect(rowCount(reader, 'exercises')).toBe(1)
      expect(rowCount(writer, 'exercises')).toBe(1)
      expect((reader.prepare('SELECT 1 AS one').get() as { one: number }).one).toBe(1)
    })

    it('reopens the same file with its rows intact after the first handle closed', () => {
      const first = openWithSchema()
      seedFullGraph(first)
      first.close()

      const second = open()

      expect(tableNames(second)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
      expect(rowCount(second, 'users')).toBe(1)
      expect(rowCount(second, 'user_routines')).toBe(1)
    })
  })
})

describe('ensureSchema', () => {
  describe('a database with no schema', () => {
    it('creates all four required tables in a file that held nothing', () => {
      const db = open()
      expect(tableNames(db)).toEqual([])

      ensureSchema(db)

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    })
  })

  describe('a database that already has the schema', () => {
    it('changes nothing, keeping a row that was already there', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      ensureSchema(db)

      expect(rowCount(db, 'users')).toBe(1)
      expect(rowCount(db, 'exercises')).toBe(1)
      expect(rowCount(db, 'user_routines')).toBe(1)
      expect(rowCount(db, 'workout_logs')).toBe(1)
    })

    it('never reads the migrations directory when all four tables are present', () => {
      const db = openWithSchema()
      const readdirSpy = vi.spyOn(fs, 'readdirSync')

      ensureSchema(db)

      expect(readdirSpy).not.toHaveBeenCalled()
    })

    it('is idempotent across repeated calls', () => {
      const db = open()

      ensureSchema(db)
      ensureSchema(db)
      ensureSchema(db)

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
      expect(tableNames(db).filter((name) => name === 'users')).toHaveLength(1)
    })
  })

  describe('a database whose schema is only partly present', () => {
    it.each(REQUIRED_TABLES.map((table) => ({ table })))(
      'throws instead of repairing when only $table is missing',
      ({ table }) => {
        const db = openWithSchema()
        db.exec(`DROP TABLE ${table}`)
        expect(tableNames(db)).not.toContain(table)

        let caught: unknown
        try {
          ensureSchema(db)
        } catch (error) {
          caught = error
        }

        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toContain('already exists')
        expect((caught as Error).message).toContain('0000_square_shadowcat.sql')
        expect((caught as Error).message).toContain(
          path.join(REPO_ROOT, MIGRATIONS_RELATIVE_PATH),
        )
      },
    )

    it('recreates the missing table before colliding when it is the first one the migration creates', () => {
      const db = openWithSchema()
      db.exec('DROP TABLE exercises')

      expect(() => ensureSchema(db)).toThrow(/already exists/)

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    })

    it('leaves the missing table absent when the collision happens before it is reached', () => {
      const db = openWithSchema()
      db.exec('DROP TABLE workout_logs')

      expect(() => ensureSchema(db)).toThrow(/already exists/)

      expect(tableNames(db)).not.toContain('workout_logs')
    })

    it('leaves the three tables that were present untouched by the failed rebuild', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      db.pragma('foreign_keys = OFF')
      db.exec('DROP TABLE workout_logs')
      db.pragma('foreign_keys = ON')

      expect(() => ensureSchema(db)).toThrow(/already exists/)

      expect(rowCount(db, 'users')).toBe(1)
      expect(rowCount(db, 'exercises')).toBe(1)
      expect(rowCount(db, 'user_routines')).toBe(1)
      expect(tableNames(db)).not.toContain('workout_logs')
    })

    it('rebuilds the whole schema once every required table is absent again', () => {
      const db = openWithSchema()
      for (const table of [...REQUIRED_TABLES].reverse()) {
        db.exec(`DROP TABLE ${table}`)
      }
      expect(tableNames(db)).toEqual([])

      ensureSchema(db)

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    })
  })

  describe('the created tables', () => {
    it('accepts rows in foreign-key order across all four tables', () => {
      const db = open()
      ensureSchema(db)

      expect(() => seedFullGraph(db)).not.toThrow()

      expect(rowCount(db, 'users')).toBe(1)
      expect(rowCount(db, 'exercises')).toBe(1)
      expect(rowCount(db, 'user_routines')).toBe(1)
      expect(rowCount(db, 'workout_logs')).toBe(1)
    })

    it('rejects a child row whose parent does not exist', () => {
      const db = open()
      ensureSchema(db)

      expect(() =>
        db
          .prepare(
            'INSERT INTO exercises (name, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
          )
          .run('Ghost Squat', 999, 1_700_000_000, 1_700_000_000),
      ).toThrow(/FOREIGN KEY constraint failed/i)
      expect(rowCount(db, 'exercises')).toBe(0)
    })

    it('keeps the unique constraints the migrations declare', () => {
      const db = open()
      ensureSchema(db)
      const { userId, exerciseId } = seedFullGraph(db)

      expect(() =>
        db
          .prepare(
            'INSERT INTO user_routines (user_id, exercise_id, day_of_week, created_at) VALUES (?, ?, ?, ?)',
          )
          .run(userId, exerciseId, 0, 1_700_000_000),
      ).toThrow(/UNIQUE constraint failed/i)
    })
  })

  describe('where the migration files come from', () => {
    it('reads them from the checkout root, never from this test file directory', () => {
      const markerRoot = path.join(root, 'marker-checkout')
      fs.mkdirSync(markerRoot, { recursive: true })
      writeMigrations(markerRoot, {
        '0000_marker.sql': [
          'CREATE TABLE users (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, name text NOT NULL);',
          'CREATE TABLE exercises (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, name text NOT NULL);',
          'CREATE TABLE user_routines (id integer PRIMARY KEY AUTOINCREMENT NOT NULL);',
          'CREATE TABLE workout_logs (id integer PRIMARY KEY AUTOINCREMENT NOT NULL);',
          'CREATE TABLE marker_table (id integer PRIMARY KEY NOT NULL);',
        ].join('\n'),
      })

      const db = open()
      withCwd(markerRoot, () => ensureSchema(db))

      expect(tableNames(db)).toContain('marker_table')
    })

    it('applies the migration files in ascending filename order', () => {
      const orderedRoot = path.join(root, 'ordered-checkout')
      fs.mkdirSync(orderedRoot, { recursive: true })
      writeMigrations(orderedRoot, {
        '0001_second.sql': 'INSERT INTO ordered_probe (label) VALUES (\'second\');',
        '0000_first.sql':
          'CREATE TABLE users (id integer); CREATE TABLE exercises (id integer); CREATE TABLE user_routines (id integer); CREATE TABLE workout_logs (id integer); CREATE TABLE ordered_probe (label text NOT NULL);',
      })

      const db = open()
      withCwd(orderedRoot, () => ensureSchema(db))

      const rows = db.prepare('SELECT label FROM ordered_probe ORDER BY rowid').all() as {
        label: string
      }[]
      expect(rows).toEqual([{ label: 'second' }])
    })

    it('ignores files that are not .sql', () => {
      const noisyRoot = path.join(root, 'noisy-checkout')
      fs.mkdirSync(noisyRoot, { recursive: true })
      writeMigrations(noisyRoot, {
        '0000_real.sql':
          'CREATE TABLE users (id integer); CREATE TABLE exercises (id integer); CREATE TABLE user_routines (id integer); CREATE TABLE workout_logs (id integer);',
        'README.md': 'this is not sql at all',
        'notes.txt': 'nor is this',
      })

      const db = open()
      withCwd(noisyRoot, () => ensureSchema(db))

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    })
  })

  describe('when the migrations cannot be applied', () => {
    it('throws naming the migrations directory it tried to read', () => {
      const missingRoot = path.join(root, 'no-src-here')
      fs.mkdirSync(missingRoot, { recursive: true })
      const expectedDir = path.join(missingRoot, MIGRATIONS_RELATIVE_PATH)
      const db = open()

      let caught: unknown
      withCwd(missingRoot, () => {
        try {
          ensureSchema(db)
        } catch (error) {
          caught = error
        }
      })

      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toContain('Cannot read the migrations directory')
      expect((caught as Error).message).toContain(expectedDir)
    })

    it('throws naming the directory when it holds no .sql file', () => {
      const emptyRoot = path.join(root, 'empty-migrations')
      fs.mkdirSync(path.join(emptyRoot, MIGRATIONS_RELATIVE_PATH), { recursive: true })
      fs.writeFileSync(path.join(emptyRoot, MIGRATIONS_RELATIVE_PATH, 'meta.json'), '{}', 'utf-8')
      const expectedDir = path.join(emptyRoot, MIGRATIONS_RELATIVE_PATH)
      const db = open()

      let caught: unknown
      withCwd(emptyRoot, () => {
        try {
          ensureSchema(db)
        } catch (error) {
          caught = error
        }
      })

      expect((caught as Error).message).toContain('No .sql migration files found')
      expect((caught as Error).message).toContain(expectedDir)
    })

    it('throws naming the migration file and the directory when the SQL fails', () => {
      const brokenRoot = path.join(root, 'broken-checkout')
      writeMigrations(brokenRoot, { '0000_broken.sql': 'THIS IS NOT SQL AT ALL;' })
      const db = open()

      let caught: unknown
      withCwd(brokenRoot, () => {
        try {
          ensureSchema(db)
        } catch (error) {
          caught = error
        }
      })

      expect((caught as Error).message).toContain('0000_broken.sql')
      expect((caught as Error).message).toContain(path.join(brokenRoot, MIGRATIONS_RELATIVE_PATH))
      expect((caught as Error).cause).toBeDefined()
    })

    it('does not reach for the migrations directory when the schema is already complete', () => {
      const missingRoot = path.join(root, 'unreachable-but-fine')
      fs.mkdirSync(missingRoot, { recursive: true })
      const db = openWithSchema()

      expect(() => withCwd(missingRoot, () => ensureSchema(db))).not.toThrow()
    })
  })

  it('resolves migrations from the repository checkout the run was started in', () => {
    const db = open()

    withCwd(REPO_ROOT, () => ensureSchema(db))

    expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    expect(indexNames(db)).toEqual(expect.arrayContaining(['users_name_unique', 'user_routine_unique']))
  })
})

describe('wipeE2eData', () => {
  describe('emptying the four tables', () => {
    it('empties all four of a fully populated database', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      wipeE2eData(db)

      for (const table of REQUIRED_TABLES) {
        expect(rowCount(db, table)).toBe(0)
      }
    })

    it.each(REQUIRED_TABLES.map((table) => ({ table })))(
      'succeeds when only $table holds rows',
      ({ table }) => {
        const db = openWithSchema()
        seedRowsInOnlyOneTable(db, table)
        expect(rowCount(db, table)).toBe(1)

        expect(() => wipeE2eData(db)).not.toThrow()

        for (const name of REQUIRED_TABLES) {
          expect(rowCount(db, name)).toBe(0)
        }
      },
    )

    it('is a no-op on an already empty database', () => {
      const db = openWithSchema()

      expect(() => wipeE2eData(db)).not.toThrow()

      for (const name of REQUIRED_TABLES) {
        expect(rowCount(db, name)).toBe(0)
      }
    })

    it('is safe to call repeatedly', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      wipeE2eData(db)
      wipeE2eData(db)

      expect(REQUIRED_TABLES.map((name) => rowCount(db, name))).toEqual([0, 0, 0, 0])
    })
  })

  describe('what it must never destroy', () => {
    it('drops no table', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      wipeE2eData(db)

      expect(tableNames(db)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
    })

    it('keeps the schema usable after wiping', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      wipeE2eData(db)

      expect(() => seedFullGraph(db)).not.toThrow()
      expect(rowCount(db, 'workout_logs')).toBe(1)
    })

    it('never deletes the database file', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      const file = openedFile(db)

      wipeE2eData(db)

      expect(fs.existsSync(file)).toBe(true)
    })

    it('leaves the indexes the migrations created in place', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      wipeE2eData(db)

      expect(indexNames(db)).toEqual(
        expect.arrayContaining(['users_name_unique', 'user_routine_unique']),
      )
    })

    it('touches nothing outside the four tables', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      db.exec('CREATE TABLE audit_trail (id integer PRIMARY KEY NOT NULL, note text NOT NULL)')
      db.exec("INSERT INTO audit_trail (id, note) VALUES (1, 'keep me')")

      wipeE2eData(db)

      expect(rowCount(db, 'audit_trail')).toBe(1)
      expect(tableNames(db)).toContain('audit_trail')
    })
  })

  describe('foreign-key ordering', () => {
    it('succeeds in one call with foreign keys on and every table populated', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      expect((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(
        1,
      )

      expect(() => wipeE2eData(db)).not.toThrow()

      expect(REQUIRED_TABLES.map((name) => rowCount(db, name))).toEqual([0, 0, 0, 0])
    })

    it('proves the order matters by rejecting the parent-first order', () => {
      const db = openWithSchema()
      seedFullGraph(db)

      expect(() => db.exec('DELETE FROM users')).toThrow(/FOREIGN KEY constraint failed/i)
      expect(() => wipeE2eData(db)).not.toThrow()
    })

    it('names the table it could not wipe', () => {
      const db = openWithSchema()
      seedFullGraph(db)
      db.pragma('foreign_keys = OFF')
      db.exec('DROP TABLE workout_logs')
      db.pragma('foreign_keys = ON')

      expect(() => wipeE2eData(db)).toThrow(/Cannot wipe "workout_logs"/)
    })
  })
})

describe('the bootstrap as a whole', () => {
  it('never reaches the application database singleton', () => {
    const db = openWithSchema()
    seedFullGraph(db)
    wipeE2eData(db)

    expect(getDatabaseMock).not.toHaveBeenCalled()
  })

  it('gives a fresh checkout a database the e2e spec can delete from at module load', () => {
    const db = open()

    expect(() => db.exec('DELETE FROM workout_logs')).toThrow(/no such table: workout_logs/)

    ensureSchema(db)

    expect(() => db.exec('DELETE FROM workout_logs')).not.toThrow()
  })
})
