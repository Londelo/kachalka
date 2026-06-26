import { describe, it, expect } from 'vitest'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteUserRepository } from '@/features/user/user-repo-impl'
import type { UserRepository } from '@/features/user/user-repository'

function setupDb(): DatabaseType {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db as DatabaseType
}

function runMigration(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `)
  db.exec(`
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)
  db.exec(`
    CREATE TABLE user_routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      day_of_week INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)
  db.exec(`
    CREATE TABLE workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      date TEXT NOT NULL,
      sets TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)
}

describe('createSqliteUserRepository', () => {
  it('creates a user and retrieves by name', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const user = repo.create({ id: { value: 0 }, name: 'Alice' })

    expect(user.name).toBe('Alice')
    expect(user.id.value).toBe(1)

    const found = repo.findByName('Alice')
    expect(found?.name).toBe('Alice')
    expect(found?.id.value).toBe(1)
  })

  it('finds a user by id', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const user = repo.create({ id: { value: 0 }, name: 'Bob' })

    const found = repo.findById(user.id.value)
    expect(found?.name).toBe('Bob')
  })

  it('returns undefined for non-existent user by id', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  it('returns undefined for non-existent user by name', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const found = repo.findByName('Nobody')
    expect(found).toBeUndefined()
  })

  it('returns all created users', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    repo.create({ id: { value: 0 }, name: 'Charlie' })
    repo.create({ id: { value: 0 }, name: 'Alice' })
    repo.create({ id: { value: 0 }, name: 'Bob' })

    const all = repo.findAll()

    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Alice')
    expect(all[1].name).toBe('Bob')
    expect(all[2].name).toBe('Charlie')
  })

  it('returns empty array when no users exist', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const all = repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('deletes a user', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    const user = repo.create({ id: { value: 0 }, name: 'Dave' })
    repo.delete(user.id.value)

    const all = repo.findAll()
    expect(all).toHaveLength(0)

    const found = repo.findById(user.id.value)
    expect(found).toBeUndefined()
  })

  it('rejects duplicate names', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    repo.create({ id: { value: 0 }, name: 'Eve' })

    expect(() => repo.create({ id: { value: 0 }, name: 'Eve' })).toThrow()
  })

  it('findAll skips rows with invalid data instead of crashing', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    repo.create({ id: { value: 0 }, name: 'ValidUser' })

    // Insert a raw row with an invalid (negative) id directly into the DB
    db.exec("INSERT INTO users (id, name, created_at, is_active) VALUES (-1, 'BadRow', strftime('%s', 'now'), 1)")

    // findAll should skip the bad row and return only the valid one
    const all = repo.findAll()

    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('ValidUser')
  })

  it('findById returns undefined for rows with invalid data', () => {
    const db = setupDb()
    runMigration(db)
    const repo = createSqliteUserRepository(db)

    // Insert a row with a null name directly into the DB
    db.exec("INSERT INTO users (id, name, created_at, is_active) VALUES (999, '', strftime('%s', 'now'), 1)")

    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  describe('delete', () => {
    it('deleting a user does not affect another user\'s exercises', () => {
      const db = setupDb()
      runMigration(db)
      const repo = createSqliteUserRepository(db)

      const bruno = repo.create({ id: { value: 0 }, name: 'Bruno' })
      const carlos = repo.create({ id: { value: 0 }, name: 'Carlos' })

      // Create exercises via direct DB insert (exercises are not owned by users in the repo, but user_id links them)
      db.exec(`
        INSERT INTO exercises (user_id, name, created_at, updated_at)
        VALUES (${bruno.id.value}, 'Bench Press', strftime('%s', 'now'), strftime('%s', 'now'))
      `)
      db.exec(`
        INSERT INTO exercises (user_id, name, created_at, updated_at)
        VALUES (${carlos.id.value}, 'Squat', strftime('%s', 'now'), strftime('%s', 'now'))
      `)

      repo.delete(bruno.id.value)

      const carlosExercise = db.prepare('SELECT * FROM exercises WHERE user_id = ?').get(carlos.id.value)
      expect(carlosExercise).toBeDefined()
    })
  })
})
