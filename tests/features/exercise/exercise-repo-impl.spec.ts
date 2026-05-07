import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import type { ExerciseRepository } from '@/features/exercise/exercise-repository'

let db: Database.Database | undefined
let repo: ExerciseRepository

function resetDb(): void {
  if (db) db.close()
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.exec(`
    CREATE TABLE user_routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, exercise_id, day_of_week)
    )
  `)
  repo = createSqliteExerciseRepository(db)
}

describe('createSqliteExerciseRepository', () => {
  beforeEach(() => {
    resetDb()
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('creates an exercise and finds it by id', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    const found = repo.findById(exercise.id.value)
    expect(found).toBeDefined()
    expect(found!.id.value).toBe(exercise.id.value)
    expect(found!.name).toBe('Squat')
    expect(found!.ownerId.value).toBe(1)
  })

  it('creates an exercise and finds it by name', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Bench Press', ownerId: { value: 1 } })
    const found = repo.findByName('Bench Press')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Bench Press')
    expect(found!.id.value).toBe(exercise.id.value)
  })

  it('returns undefined when findById for non-existent exercise', () => {
    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  it('returns undefined when findByName for non-existent exercise', () => {
    const found = repo.findByName('Nobody')
    expect(found).toBeUndefined()
  })

  it('findAll returns all exercises ordered by name', () => {
    repo.create({ id: { value: 0 }, name: 'Deadlift', ownerId: { value: 1 } })
    repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    repo.create({ id: { value: 0 }, name: 'Bench Press', ownerId: { value: 2 } })

    const all = repo.findAll()
    expect(all).toHaveLength(3)
    expect(all[0].name).toBe('Bench Press')
    expect(all[1].name).toBe('Deadlift')
    expect(all[2].name).toBe('Squat')
  })

  it('findAll returns empty array when no exercises exist', () => {
    const all = repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('delete removes an exercise from findAll results', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Pull-up', ownerId: { value: 1 } })
    repo.delete(exercise.id.value)

    const found = repo.findById(exercise.id.value)
    expect(found).toBeUndefined()

    const all = repo.findAll()
    expect(all).toHaveLength(0)
  })

  it('updateName changes the exercise name', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    const updated = repo.updateName(exercise.id.value, 'Back Squat')!

    expect(updated.name).toBe('Back Squat')
    expect(updated.id.value).toBe(exercise.id.value)
    expect(updated.ownerId.value).toBe(1)
  })

  it('updateName returns undefined for non-existent exercise', () => {
    const result = repo.updateName(999, 'New Name')
    expect(result).toBeUndefined()
  })

  it('findByOwner returns only exercises owned by the user', () => {
    repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    repo.create({ id: { value: 0 }, name: 'Bench', ownerId: { value: 1 } })
    repo.create({ id: { value: 0 }, name: 'Deadlift', ownerId: { value: 2 } })

    const owned = repo.findByOwner(1)
    expect(owned).toHaveLength(2)
    expect(owned[0].name).toBe('Bench')
    expect(owned[1].name).toBe('Squat')
  })

  it('findByOwner returns empty array when user has no exercises', () => {
    repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    const owned = repo.findByOwner(99)
    expect(owned).toHaveLength(0)
  })

  it('inAnyRoutine returns false when exercise is not in any routine', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    const result = repo.inAnyRoutine(exercise.id.value)
    expect(result).toBe(false)
  })

  it('inAnyRoutine returns true when exercise is in a routine', () => {
    const exercise = repo.create({ id: { value: 0 }, name: 'Squat', ownerId: { value: 1 } })
    db!.exec(`INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (1, ${exercise.id.value}, 1)`)
    const result = repo.inAnyRoutine(exercise.id.value)
    expect(result).toBe(true)
  })

  it('inAnyRoutine returns false for non-existent exercise', () => {
    const result = repo.inAnyRoutine(999)
    expect(result).toBe(false)
  })
})
