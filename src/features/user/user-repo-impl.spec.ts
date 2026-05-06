import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteUserRepository } from './user-repo-impl'
import type { UserRepository } from './user-repository'

let db: Database.Database | undefined
let repo: UserRepository

function resetDb(): void {
  if (db) db.close()
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const queryDb = drizzle(db, { schema })
  // Use Drizzle to create tables via raw SQL with constant defaults
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `)
  repo = createSqliteUserRepository(db)
}

describe('createSqliteUserRepository', () => {
  beforeEach(() => {
    resetDb()
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('creates a user and finds it by id', () => {
    const user = repo.create({ id: { value: 0 }, name: 'Alice', email: 'alice@example.com' })
    const found = repo.findById(user.id.value)
    expect(found).toBeDefined()
    expect(found!.id.value).toBe(user.id.value)
    expect(found!.name).toBe('Alice')
  })

  it('creates a user and finds it by name', () => {
    const user = repo.create({ id: { value: 0 }, name: 'Bob', email: 'bob@example.com' })
    const found = repo.findByName('Bob')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Bob')
    expect(found!.id.value).toBe(user.id.value)
  })

  it('returns undefined when findById for non-existent user', () => {
    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  it('returns undefined when findByName for non-existent user', () => {
    const found = repo.findByName('Nobody')
    expect(found).toBeUndefined()
  })

  it('findAll returns all users ordered by name', () => {
    repo.create({ id: { value: 0 }, name: 'Charlie', email: 'charlie@example.com' })
    repo.create({ id: { value: 0 }, name: 'Alice', email: 'alice@example.com' })
    repo.create({ id: { value: 0 }, name: 'Bob', email: 'bob@example.com' })

    const all = repo.findAll()
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Alice')
    expect(all[1].name).toBe('Bob')
    expect(all[2].name).toBe('Charlie')
  })

  it('findAll returns empty array when no users exist', () => {
    const all = repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('delete removes a user from findAll results', () => {
    const user = repo.create({ id: { value: 0 }, name: 'Dave', email: 'dave@example.com' })
    repo.delete(user.id.value)

    const found = repo.findById(user.id.value)
    expect(found).toBeUndefined()

    const all = repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('rejects duplicate names on create', () => {
    repo.create({ id: { value: 0 }, name: 'Eve', email: 'eve@example.com' })
    expect(() =>
      repo.create({ id: { value: 0 }, name: 'Eve', email: 'eve2@example.com' }),
    ).toThrow()
  })
})
