import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import type { WorkoutRepository } from '@/features/workout/workout-repository'

let db: Database.Database | undefined
let repo: WorkoutRepository

function resetDb(): void {
  if (db) db.close()
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
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
  db.exec(`
    CREATE TABLE workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      date TEXT NOT NULL,
      sets TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
  repo = createSqliteWorkoutRepository(db)
}

describe('createSqliteWorkoutRepository', () => {
  beforeEach(() => {
    resetDb()
  })

  afterEach(() => {
    if (db) db.close()
  })

  it('creates a log and returns it with an id', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    const log = repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    expect(log.id.value).toBeGreaterThan(0)
    expect(log.userId).toBe(user.lastInsertRowid!)
    expect(log.exerciseId).toBe(exercise.lastInsertRowid!)
    expect(log.date).toBe('2025-01-01')
    expect(log.sets).toHaveLength(1)
  })

  it('returns a log when findById finds it', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    const inserted = repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    const found = repo.findById(inserted.id.value)
    expect(found).toBeDefined()
    expect(found!.id.value).toBe(inserted.id.value)
    expect(found!.userId).toBe(user.lastInsertRowid!)
  })

  it('returns undefined when findById for non-existent log', () => {
    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  it('finds a log by userId, date, and exerciseId', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    const found = repo.findByDateAndExercise(user.lastInsertRowid!, '2025-01-01', exercise.lastInsertRowid!)
    expect(found).toBeDefined()
    expect(found!.date).toBe('2025-01-01')
  })

  it('returns undefined when findByDateAndExercise does not match', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    const found = repo.findByDateAndExercise(user.lastInsertRowid!, '2025-02-02', exercise.lastInsertRowid!)
    expect(found).toBeUndefined()
  })

  it('finds all logs for a user on a specific date', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const ex1 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const ex2 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)

    repo.create({ userId: user.lastInsertRowid!, exerciseId: ex1.lastInsertRowid!, date: '2025-01-01', sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }] })
    repo.create({ userId: user.lastInsertRowid!, exerciseId: ex2.lastInsertRowid!, date: '2025-01-01', sets: [{ reps: 3, weight: 80, rpe: 8, rest: 90, note: '' }] })
    repo.create({ userId: user.lastInsertRowid!, exerciseId: ex1.lastInsertRowid!, date: '2025-01-02', sets: [{ reps: 5, weight: 105, rpe: 7, rest: 60, note: '' }] })

    const logs = repo.findByDate(user.lastInsertRowid!, '2025-01-01')
    expect(logs).toHaveLength(2)
  })

  it('finds all logs for a user across dates', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)

    repo.create({ userId: user.lastInsertRowid!, exerciseId: exercise.lastInsertRowid!, date: '2025-01-01', sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }] })
    repo.create({ userId: user.lastInsertRowid!, exerciseId: exercise.lastInsertRowid!, date: '2025-01-02', sets: [{ reps: 5, weight: 105, rpe: 8, rest: 60, note: '' }] })

    const all = repo.findAllByUser(user.lastInsertRowid!)
    expect(all).toHaveLength(2)
  })

  it('updates sets on an existing log', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    const inserted = repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    const updated = repo.update(inserted.id.value, [
      { reps: 5, weight: 100, rpe: 7, rest: 60, note: '' },
      { reps: 5, weight: 110, rpe: 8, rest: 60, note: '' },
    ])!

    expect(updated).toBeDefined()
    expect(updated!.sets).toHaveLength(2)
    expect(updated!.sets[1].weight).toBe(110)
  })

  it('returns undefined when update for non-existent log', () => {
    const result = repo.update(999, [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }])
    expect(result).toBeUndefined()
  })

  it('deletes a log', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    const inserted = repo.create({
      userId: user.lastInsertRowid!,
      exerciseId: exercise.lastInsertRowid!,
      date: '2025-01-01',
      sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }],
    })

    repo.delete(inserted.id.value)

    const found = repo.findById(inserted.id.value)
    expect(found).toBeUndefined()
  })

  it('findByDayOfWeek returns logs for a user', () => {
    const user = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(user.lastInsertRowid!, exercise.lastInsertRowid!, 0)

    repo.create({ userId: user.lastInsertRowid!, exerciseId: exercise.lastInsertRowid!, date: '2025-01-01', sets: [{ reps: 5, weight: 100, rpe: 7, rest: 60, note: '' }] })
    repo.create({ userId: user.lastInsertRowid!, exerciseId: exercise.lastInsertRowid!, date: '2025-01-08', sets: [{ reps: 5, weight: 105, rpe: 8, rest: 60, note: '' }] })

    const logs = repo.findByDayOfWeek(user.lastInsertRowid!, 0)
    expect(logs).toHaveLength(1)
  })
})
