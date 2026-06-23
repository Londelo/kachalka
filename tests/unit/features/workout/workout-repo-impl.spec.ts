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
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)

    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)
    const log = repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
    })

    expect(log.id).toBeGreaterThan(0)
    expect(log.userId).toBe(Number(user.lastInsertRowid))
    expect(log.exerciseId).toBe(Number(exercise.lastInsertRowid))
    expect(log.date).toBe('2025-01-01')
    expect(log.sets).toHaveLength(1)
  })

  it('returns a log when findById finds it', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    const inserted = repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [{ id: 's1', reps: 5, weight: 100 }],
    })

    const found = repo.findById(inserted.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(inserted.id)
    expect(found!.userId).toBe(Number(user.lastInsertRowid))
  })

  it('returns undefined when findById for non-existent log', () => {
    const found = repo.findById(999)
    expect(found).toBeUndefined()
  })

  it('finds a log by userId, date, and exerciseId', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })

    const found = repo.findByDateAndExercise(userId, '2025-01-01', exerciseId)
    expect(found).toBeDefined()
    expect(found!.date).toBe('2025-01-01')
  })

  it('returns undefined when findByDateAndExercise does not match', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })

    const found = repo.findByDateAndExercise(userId, '2025-02-02', exerciseId)
    expect(found).toBeUndefined()
  })

  it('finds all logs for a user on a specific date', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const ex1 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const ex2 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const ex1Id = Number(ex1.lastInsertRowid)
    const ex2Id = Number(ex2.lastInsertRowid)

    repo.create({ userId, exerciseId: ex1Id, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId: ex2Id, date: '2025-01-01', sets: [{ id: 's2', reps: 3, weight: 80 }] })
    repo.create({ userId, exerciseId: ex1Id, date: '2025-01-02', sets: [{ id: 's3', reps: 5, weight: 105 }] })

    const logs = repo.findByDate(userId, '2025-01-01')
    expect(logs).toHaveLength(2)
  })

  it('finds all logs for a user across dates', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId, exerciseId, 0)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId, date: '2025-01-02', sets: [{ id: 's2', reps: 5, weight: 105 }] })

    const all = repo.findAllByUser(userId)
    expect(all).toHaveLength(2)
  })

  it('updates sets on an existing log', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    const inserted = repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })

    const updated = repo.update(inserted.id, [
      { id: 's1', reps: 5, weight: 100 },
      { id: 's2', reps: 5, weight: 110 },
    ])!

    expect(updated).toBeDefined()
    expect(updated!.sets).toHaveLength(2)
    expect(updated!.sets[1].weight).toBe(110)
  })

  it('returns undefined when update for non-existent log', () => {
    const result = repo.update(999, [{ id: 's1', reps: 5, weight: 100 }])
    expect(result).toBeUndefined()
  })

  it('deletes a log', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    const inserted = repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })

    repo.delete(inserted.id)

    const found = repo.findById(inserted.id)
    expect(found).toBeUndefined()
  })

  it('findByDayOfWeek returns logs for a user', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId, exerciseId, 0)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId, date: '2025-01-08', sets: [{ id: 's2', reps: 5, weight: 105 }] })

    const logs = repo.findByDayOfWeek(userId, 0)
    expect(logs).toHaveLength(1)
  })

  it('findLatestForExercise returns the most recent log for a userId and exerciseId', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId, exerciseId, 0)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId, date: '2025-01-08', sets: [{ id: 's2', reps: 5, weight: 105 }] })

    const latest = repo.findLatestForExercise(userId, exerciseId)
    expect(latest).toBeDefined()
    expect(latest!.date).toBe('2025-01-08')
    expect(latest!.sets[0].weight).toBe(105)
  })

  it('findLatestForExercise returns undefined when no logs exist for the exercise', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    const latest = repo.findLatestForExercise(userId, exerciseId)
    expect(latest).toBeUndefined()
  })

  it('findLatestForExercise returns the latest even when multiple logs exist for different dates', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId, exerciseId, 0)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId, date: '2025-01-15', sets: [{ id: 's2', reps: 5, weight: 110 }] })
    repo.create({ userId, exerciseId, date: '2025-01-08', sets: [{ id: 's3', reps: 5, weight: 105 }] })

    const latest = repo.findLatestForExercise(userId, exerciseId)
    expect(latest).toBeDefined()
    expect(latest!.date).toBe('2025-01-15')
    expect(latest!.sets[0].weight).toBe(110)
  })

  it('findLatestForExercise returns the log for the correct user when multiple users have the exercise', () => {
    const user1 = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const user2 = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Bob')
    const exercise1 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user1.lastInsertRowid!)
    const exercise2 = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user2.lastInsertRowid!)
    const userId1 = Number(user1.lastInsertRowid)
    const userId2 = Number(user2.lastInsertRowid)
    const exerciseId1 = Number(exercise1.lastInsertRowid)
    const exerciseId2 = Number(exercise2.lastInsertRowid)

    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId1, exerciseId1, 0)
    db!.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(userId2, exerciseId2, 0)

    repo.create({ userId: userId1, exerciseId: exerciseId1, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId: userId1, exerciseId: exerciseId1, date: '2025-01-08', sets: [{ id: 's2', reps: 5, weight: 105 }] })
    repo.create({ userId: userId2, exerciseId: exerciseId2, date: '2025-01-15', sets: [{ id: 's3', reps: 5, weight: 200 }] })

    const aliceLatest = repo.findLatestForExercise(userId1, exerciseId1)
    expect(aliceLatest!.date).toBe('2025-01-08')
    expect(aliceLatest!.sets[0].weight).toBe(105)

    const bobLatest = repo.findLatestForExercise(userId2, exerciseId2)
    expect(bobLatest!.date).toBe('2025-01-15')
    expect(bobLatest!.sets[0].weight).toBe(200)
  })

  it('findHistoryByDate returns logs grouped by date, newest date first', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId, date: '2025-01-08', sets: [{ id: 's2', reps: 5, weight: 105 }] })
    repo.create({ userId, exerciseId, date: '2025-01-15', sets: [{ id: 's3', reps: 5, weight: 110 }] })

    const history = repo.findHistoryByDate(userId)

    expect(history).toHaveLength(3)
    expect(history[0].date).toBe('2025-01-15')
    expect(history[1].date).toBe('2025-01-08')
    expect(history[2].date).toBe('2025-01-01')
  })

  it('findHistoryByDate returns groups with exercise names', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const squat = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const bench = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Bench Press', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const squatId = Number(squat.lastInsertRowid)
    const benchId = Number(bench.lastInsertRowid)

    repo.create({ userId, exerciseId: squatId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId: benchId, date: '2025-01-01', sets: [{ id: 's2', reps: 3, weight: 80 }] })

    const history = repo.findHistoryByDate(userId)

    expect(history).toHaveLength(1)
    expect(history[0].logs).toHaveLength(2)
    const names = history[0].logs.map((log) => log.exerciseName)
    expect(names).toContain('Squat')
    expect(names).toContain('Bench Press')
  })

  it('findHistoryByDate returns empty array when user has no logs', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const userId = Number(user.lastInsertRowid)

    const history = repo.findHistoryByDate(userId)

    expect(history).toEqual([])
  })

  it('findHistoryByDate calculates volume correctly per log', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [
        { id: 's1', reps: 5, weight: 100 },
        { id: 's2', reps: 5, weight: 110 },
      ],
    })

    const history = repo.findHistoryByDate(userId)

    expect(history).toHaveLength(1)
    expect(history[0].logs[0].volume).toBe(1050) // 5*100 + 5*110
  })

  it('findHistoryByDate groups multiple exercises on the same date together', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const squat = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const deadlift = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Deadlift', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const squatId = Number(squat.lastInsertRowid)
    const deadliftId = Number(deadlift.lastInsertRowid)

    repo.create({ userId, exerciseId: squatId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    repo.create({ userId, exerciseId: deadliftId, date: '2025-01-01', sets: [{ id: 's2', reps: 3, weight: 200 }] })

    const history = repo.findHistoryByDate(userId)

    expect(history).toHaveLength(1)
    expect(history[0].date).toBe('2025-01-01')
    expect(history[0].logs).toHaveLength(2)
  })

  it('findHistoryByDate returns correct log ids', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    const log1 = repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })
    const log2 = repo.create({ userId, exerciseId, date: '2025-01-08', sets: [{ id: 's2', reps: 5, weight: 105 }] })

    const history = repo.findHistoryByDate(userId)

    const allLogs = history.flatMap((day) => day.logs)
    const ids = allLogs.map((log) => log.id)
    expect(ids).toContain(log1.id)
    expect(ids).toContain(log2.id)
  })

  it('findHistoryByDate returns JSON-serializable data (no Drizzle value objects)', () => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 's1', reps: 5, weight: 100 }] })

    const history = repo.findHistoryByDate(userId)

    // Should not throw — catches any remaining Drizzle value objects
    expect(() => JSON.stringify(history)).not.toThrow()
    const serialized = JSON.parse(JSON.stringify(history))
    expect(serialized).toHaveLength(1)
    expect(serialized[0].logs[0].id).toBe(1)
    expect(serialized[0].logs[0].exerciseName).toBe('Squat')
    expect(serialized[0].logs[0].volume).toBe(500)
  })
})
