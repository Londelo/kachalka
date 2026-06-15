import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteUserRepository } from '@/features/user/user-repo-impl'
import type { UserRepository } from '@/features/user/user-repository'

function setupDb(): Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function runMigration(db: Database): void {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
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

    const user = repo.create({ id: { value: 0 }, name: 'Alice', email: 'alice@example.com' })

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

    const user = repo.create({ id: { value: 0 }, name: 'Bob', email: 'bob@example.com' })

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

    repo.create({ id: { value: 0 }, name: 'Charlie', email: 'charlie@example.com' })
    repo.create({ id: { value: 0 }, name: 'Alice', email: 'alice@example.com' })
    repo.create({ id: { value: 0 }, name: 'Bob', email: 'bob@example.com' })

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

    const user = repo.create({ id: { value: 0 }, name: 'Dave', email: 'dave@example.com' })
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

    repo.create({ id: { value: 0 }, name: 'Eve', email: 'eve@example.com' })

    expect(() => repo.create({ id: { value: 0 }, name: 'Eve', email: 'eve@example.com' })).toThrow()
  })
})
