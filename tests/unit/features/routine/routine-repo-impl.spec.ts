import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import type { RoutineRepository } from '@/features/routine/routine-repository'

let db: Database.Database | undefined
let repo: RoutineRepository

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
            created_at INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `)
  db.exec(`
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.exec(`
    CREATE TABLE user_routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      day_of_week INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, exercise_id, day_of_week)
    )
  `)
  repo = createSqliteRoutineRepository(db)
}

describe('createSqliteRoutineRepository', () => {
  beforeEach(() => {
    resetDb()
  })

  afterEach(() => {
    if (db) db.close()
  })

  describe('exerciseExists', () => {
    it('returns true when exercise exists', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)

      expect(repo.exerciseExists(1)).toBe(true)
    })

    it('returns false when exercise does not exist', () => {
      expect(repo.exerciseExists(999)).toBe(false)
    })
  })

  describe('findById', () => {
    it('finds an assignment by id', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const routine = db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)

      const found = repo.findById(Number(routine.lastInsertRowid))
      expect(found).toBeDefined()
      expect(found!.id.value).toBe(Number(routine.lastInsertRowid))
      expect(found!.userId).toBe(user.lastInsertRowid!)
      expect(found!.dayOfWeek).toBe('Monday')
    })

    it('returns undefined when assignment not found', () => {
      const found = repo.findById(999)
      expect(found).toBeUndefined()
    })
  })

  describe('findByUserAndDay', () => {
    it('returns an assignment for a user on a specific day', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)

      const found = repo.findByUserAndDay(Number(user.lastInsertRowid), 0)
      expect(found).toBeDefined()
      expect(found!.userId).toBe(Number(user.lastInsertRowid))
      expect(found!.dayOfWeek).toBe('Monday')
    })

    it('returns undefined when no assignment for user and day', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const found = repo.findByUserAndDay(Number(user.lastInsertRowid), 0)
      expect(found).toBeUndefined()
    })
  })

  describe('findAllByUser', () => {
    it('returns all assignments for a user', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const ex1 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
      const ex2 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const ex3 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Deadlift', user.lastInsertRowid!)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex2.lastInsertRowid!, 4)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex1.lastInsertRowid!, 0)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex3.lastInsertRowid!, 3)

      const results = repo.findAllByUser(Number(user.lastInsertRowid))
      expect(results).toHaveLength(3)
      // Verify all expected days are present (order not guaranteed without ORDER BY)
      const days = results.map(r => r.dayOfWeek)
      expect(days).toContain('Monday')
      expect(days).toContain('Thursday')
      expect(days).toContain('Friday')
    })

    it('returns empty array when user has no assignments', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const results = repo.findAllByUser(Number(user.lastInsertRowid))
      expect(results).toHaveLength(0)
    })
  })

  describe('findAllByUserGroupedByDay', () => {
    it('groups assignments by day of week', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const ex1 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const ex2 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
      const ex3 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Deadlift', user.lastInsertRowid!)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex1.lastInsertRowid!, 0)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex2.lastInsertRowid!, 0)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex3.lastInsertRowid!, 3)

      const result = repo.findAllByUserGroupedByDay(Number(user.lastInsertRowid))
      expect(result).toHaveProperty('Monday')
      expect(result).toHaveProperty('Thursday')
      expect(result['Monday']).toHaveLength(2)
      expect(result['Thursday']).toHaveLength(1)
    })

    it('handles single day with single exercise', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const ex = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, ex.lastInsertRowid!, 0)

      const result = repo.findAllByUserGroupedByDay(Number(user.lastInsertRowid))
      expect(result).toEqual({ Monday: expect.any(Array) })
      expect(result['Monday']).toHaveLength(1)
    })

    it('returns empty object when user has no assignments', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const result = repo.findAllByUserGroupedByDay(Number(user.lastInsertRowid))
      expect(result).toEqual({})
    })
  })

  describe('create', () => {
    it('inserts an assignment and returns persisted object with id', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)

      const userId = Number(user.lastInsertRowid)
      const exerciseId = Number(exercise.lastInsertRowid)
      const assignment = { id: { value: 0 }, userId, exerciseId, dayOfWeek: 'Monday' as const }
      const result = repo.create(assignment)

      expect(result.id.value).toBeGreaterThan(0)
      expect(result.userId).toBe(userId)
      expect(result.exerciseId).toBe(exerciseId)
      expect(result.dayOfWeek).toBe('Monday')
    })

    it('throws on duplicate assignment', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const userId = Number(user.lastInsertRowid)
      const exerciseId = Number(exercise.lastInsertRowid)

      const assignment = { id: { value: 0 }, userId, exerciseId, dayOfWeek: 'Monday' as const }
      repo.create(assignment)

      expect(() => repo.create(assignment)).toThrow()
    })
  })

  describe('delete', () => {
    it('removes an assignment', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const routine = db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)
      const id = Number(routine.lastInsertRowid!)

      const foundBefore = repo.findById(id)
      expect(foundBefore).toBeDefined()

      repo.delete(id)

      const foundAfter = repo.findById(id)
      expect(foundAfter).toBeUndefined()
    })
  })

  describe('exists', () => {
    it('returns true when assignment exists', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
      const routine = db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)
      const id = Number(routine.lastInsertRowid!)

      expect(repo.exists(id)).toBe(true)
    })

    it('returns false when assignment does not exist', () => {
      const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
      const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)

      expect(repo.exists(999)).toBe(false)
    })
  })
})
