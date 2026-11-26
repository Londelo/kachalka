import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import { getSetCount } from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

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

const volumeOf = (sets: WorkoutSet[]): number =>
  sets.reduce((total, line) => total + getSetCount(line) * line.reps * line.weight, 0)

/**
 * The two tallies the War Logs page derives for itself: `HistoryPageClient` sums
 * `log.sets.length` for SETS and `set.reps` for REPS. Neither is a door output —
 * each is arithmetic the page runs over the lines this door publishes — so both are
 * correct only while the door hands back one line per set the lifter actually
 * logged. A door that folds identical lines on the way out keeps `volumeOf` exact
 * (calculateVolume multiplies by the folded tally) and silently reports `SETS 1`
 * for three sets of ten, which is the defect these two helpers exist to make
 * unfailable at the door rather than downstream in the page.
 */
const tallyOf = (sets: WorkoutSet[]): number =>
  sets.reduce((total, line) => total + getSetCount(line), 0)

const repsOf = (sets: WorkoutSet[]): number =>
  sets.reduce((total, line) => total + line.reps, 0)

describe('findHistoryByDate — counted sets', () => {
  let userId: number
  let exerciseId: number

  const seedUserAndExercise = (userName = 'Alice', exerciseName = 'Squat'): {
    userId: number
    exerciseId: number
  } => {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run(userName)
    const exercise = db!
      .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
      .run(exerciseName, user.lastInsertRowid!)
    return {
      userId: Number(user.lastInsertRowid),
      exerciseId: Number(exercise.lastInsertRowid),
    }
  }

  const insertRawSingleEncoded = (logUserId: number, logExerciseId: number, date: string, sets: WorkoutSet[]): void => {
    db!
      .prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)')
      .run(logUserId, logExerciseId, date, JSON.stringify(sets))
  }

  beforeEach(() => {
    resetDb()
    const seeded = seedUserAndExercise()
    userId = seeded.userId
    exerciseId = seeded.exerciseId
  })

  afterEach(() => {
    if (db) db.close()
  })

  /**
   * The read contract, one row per shape the column can hold.
   *
   * `findHistoryByDate` is a read door, so what it publishes is what was stored:
   * every line, in order, each owning its own `count`, and no `count` key on a line
   * the lifter never gave one. Folding is the write path's rule (`log-workout.ts`
   * collapses before it stores) and this door runs after it, so a fold here would
   * fold twice — and, unlike the write, it would fold data it never authored.
   *
   * `expectedVolume` is unchanged from the folded era on every row: `calculateVolume`
   * multiplies each line by its own tally, so it is fold-invariant. The volume was
   * never the number at risk; the line count was.
   */
  const cases: {
    name: string
    sets: WorkoutSet[]
    expectedVolume: number
  }[] = [
    {
      name: 'two identical counted lines stay two lines, each keeping its own tally',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 2 },
      ],
      expectedVolume: 2000,
    },
    {
      name: 'three identical counted lines stay three lines rather than accumulating into one',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 2 },
        { id: 'c', reps: 5, weight: 100, count: 2 },
      ],
      expectedVolume: 3000,
    },
    {
      name: 'a counted line beside a legacy line of the same work stays two lines',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100 },
      ],
      expectedVolume: 1500,
    },
    {
      name: 'one counted line keeps its count',
      sets: [{ id: 'a', reps: 5, weight: 135, count: 3 }],
      expectedVolume: 2025,
    },
    {
      name: 'a legacy line with no count key keeps its pre-change volume',
      sets: [{ id: 'a', reps: 5, weight: 135 }],
      expectedVolume: 675,
    },
    {
      name: 'a legacy line beside a differently-weighted counted line',
      sets: [
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 3, weight: 80, count: 2 },
      ],
      expectedVolume: 980,
    },
    {
      name: 'two 2.5 lines floor per line before summing, so the volume prices 4 sets not 5',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2.5 },
        { id: 'b', reps: 5, weight: 100, count: 2.5 },
      ],
      expectedVolume: 2000,
    },
    {
      name: 'an explicit count of one',
      sets: [{ id: 'a', reps: 5, weight: 100, count: 1 }],
      expectedVolume: 500,
    },
    {
      name: 'lines sharing weight but not reps stay separate',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 3, weight: 100, count: 2 },
      ],
      expectedVolume: 1600,
    },
    {
      name: 'lines sharing reps but not weight stay separate',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 110, count: 2 },
      ],
      expectedVolume: 2100,
    },
  ]

  it.each(cases)(
    'publishes every stored line and a volume of $expectedVolume — $name',
    ({ sets, expectedVolume }) => {
      // Snapshotted before the write: `repo.create` takes this very array by
      // reference, so comparing the door's output against `sets` afterwards would
      // let a writer that folded in place grade its own homework.
      const written = structuredClone(sets)
      repo.create({ userId, exerciseId, date: '2025-01-01', sets })

      const log = repo.findHistoryByDate(userId)[0].logs[0]

      // toStrictEqual, not toEqual: an absent `count` and a `count: undefined` are
      // two different promises about a legacy line, and only this matcher tells them apart.
      expect(log.sets).toStrictEqual(written)
      expect(log.volume).toBe(expectedVolume)
      expect(log.volume).toBe(volumeOf(log.sets))
    },
  )

  it('hands a legacy run of three identical uncounted lines back as three lines, so the page tallies 3 sets and 30 reps', () => {
    // The fixture the browser caught and the suite did not. The write path folds
    // identical lines before it stores, so a row holding three of them can only be
    // legacy data — precisely the three uncounted `{ reps: 10, weight: 100 }` lines
    // tests/e2e/history-page.spec.ts writes for one session. A door that folded them
    // priced the session correctly (3,000 either way) while War Logs rendered
    // `SETS 1 / REPS 10` for three sets of ten. Volume cannot see this defect; only
    // the line count and the reps sum can, which is why both are asserted here.
    insertRawSingleEncoded(userId, exerciseId, '2025-01-01', [
      { id: 's1', reps: 10, weight: 100 },
      { id: 's2', reps: 10, weight: 100 },
      { id: 's3', reps: 10, weight: 100 },
    ])

    const log = repo.findHistoryByDate(userId)[0].logs[0]

    expect(log.sets).toStrictEqual([
      { id: 's1', reps: 10, weight: 100 },
      { id: 's2', reps: 10, weight: 100 },
      { id: 's3', reps: 10, weight: 100 },
    ])
    expect(log.sets.every((line) => !('count' in line))).toBe(true)

    // The three numbers the page shows for this session, all derived from these lines.
    expect(tallyOf(log.sets)).toBe(3)
    expect(log.sets.length).toBe(3)
    expect(repsOf(log.sets)).toBe(30)
    expect(log.volume).toBe(3000)
  })

  it('leaves a legacy line un-stamped — the door invents no count the lifter never entered', () => {
    const created = repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [{ id: 'a', reps: 5, weight: 135 }],
    })

    // Witness at the column first: the stored bytes carry no count either, so the
    // door cannot plead that it was merely reading one back.
    const stored = db!.prepare('SELECT sets FROM workout_logs WHERE id = ?').get(created.id) as {
      sets: string
    }
    expect(JSON.parse(JSON.parse(stored.sets) as string)).toStrictEqual([
      { id: 'a', reps: 5, weight: 135 },
    ])

    const log = repo.findHistoryByDate(userId)[0].logs[0]

    expect(log.volume).toBe(675)
    expect('count' in log.sets[0]).toBe(false)
    expect(Object.keys(log.sets[0]).sort()).toEqual(['id', 'reps', 'weight'])
    expect(tallyOf(log.sets)).toBe(1)
  })

  it('parses the double-encoded column that repo.create writes, arriving as raw JSON text', () => {
    repo.create({ userId, exerciseId, date: '2025-01-01', sets: [{ id: 'a', reps: 5, weight: 135, count: 3 }] })

    const stored = db!.prepare('SELECT sets FROM workout_logs WHERE id = ?').get(1) as { sets: unknown }
    expect(typeof stored.sets).toBe('string')

    const log = repo.findHistoryByDate(userId)[0].logs[0]
    expect(log.volume).toBe(2025)
    expect(log.sets[0].count).toBe(3)
  })

  it('parses a pre-change row that arrives as an already-parsed array', () => {
    insertRawSingleEncoded(userId, exerciseId, '2025-01-01', [
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])

    const log = repo.findHistoryByDate(userId)[0].logs[0]

    // The arrival branch under test is the already-parsed array, not the fold: both
    // stored lines come back, each still owning its own tally of 2.
    expect(log.sets).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])
    expect(log.volume).toBe(2000)
    expect(log.volume).toBe(volumeOf(log.sets))
  })

  it('stores the count verbatim in the column, one unwrap below the double-encoded surface', () => {
    const input: WorkoutSet[] = [{ id: 'a', reps: 5, weight: 135, count: 3 }]
    const created = repo.create({ userId, exerciseId, date: '2025-01-01', sets: input })

    const stored = db!.prepare('SELECT sets FROM workout_logs WHERE id = ?').get(created.id) as { sets: string }
    const oneLayerUnwrapped = JSON.parse(stored.sets) as unknown

    expect(stored.sets).not.toBe(JSON.stringify(input))
    expect(typeof oneLayerUnwrapped).toBe('string')
    expect(oneLayerUnwrapped).toContain('"count":3')
    expect((JSON.parse(oneLayerUnwrapped as string) as WorkoutSet[])[0].count).toBe(3)
  })

  it('survives a JSON round-trip with each line still owning its own numeric count', () => {
    repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 2 },
      ],
    })

    const history = repo.findHistoryByDate(userId)
    const serialized = JSON.parse(JSON.stringify(history))

    // The server action serialises this payload to the browser, so a tally that
    // arrived as a string, or that the fold had merged into a single line, would
    // only surface after the wire. Both lines, both tallies, still numbers.
    expect(serialized[0].logs[0].sets).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])
    expect(serialized[0].logs[0].sets.map((line: WorkoutSet) => typeof line.count)).toEqual([
      'number',
      'number',
    ])
    expect(serialized[0].logs[0].volume).toBe(2000)
  })

  it('groups two counted exercises under one date with their own volumes, sets and ids', () => {
    const deadlift = db!
      .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
      .run('Deadlift', userId)
    const deadliftId = Number(deadlift.lastInsertRowid)

    const squatLog = repo.create({
      userId,
      exerciseId,
      date: '2025-01-01',
      sets: [
        { id: 'a', reps: 5, weight: 100, count: 2 },
        { id: 'b', reps: 5, weight: 100, count: 2 },
      ],
    })
    const deadliftLog = repo.create({
      userId,
      exerciseId: deadliftId,
      date: '2025-01-01',
      sets: [{ id: 'c', reps: 3, weight: 200, count: 4 }],
    })

    const history = repo.findHistoryByDate(userId)

    expect(history).toHaveLength(1)
    expect(history[0].date).toBe('2025-01-01')
    expect(history[0].logs).toHaveLength(2)

    const byName = Object.fromEntries(history[0].logs.map((log) => [log.exerciseName, log]))
    expect(byName.Squat.id).toBe(squatLog.id)
    expect(byName.Squat.sets).toStrictEqual([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])
    expect(byName.Squat.volume).toBe(2000)
    expect(byName.Squat.volume).toBe(volumeOf(byName.Squat.sets))

    expect(byName.Deadlift.id).toBe(deadliftLog.id)
    expect(byName.Deadlift.sets).toHaveLength(1)
    expect(byName.Deadlift.sets[0].count).toBe(4)
    expect(byName.Deadlift.volume).toBe(2400)
    expect(byName.Deadlift.volume).toBe(volumeOf(byName.Deadlift.sets))
  })

  it('returns an empty array for a user whose counted logs belong to somebody else', () => {
    const other = seedUserAndExercise('Bob', 'Squat')
    repo.create({
      userId: other.userId,
      exerciseId: other.exerciseId,
      date: '2025-01-01',
      sets: [{ id: 'a', reps: 5, weight: 135, count: 3 }],
    })

    expect(repo.findHistoryByDate(userId)).toEqual([])
    expect(repo.findHistoryByDate(other.userId)[0].logs[0].volume).toBe(2025)
  })

  it('publishes the very lines every other read door publishes for the same stored bytes', () => {
    // The isolation claim, stated at the door. `findById`, `findByDate`,
    // `findByDateAndExercise`, `findAllByUser` and `findLatestForExercise` all map
    // their row through `mapRowToWorkoutLog` and hand the stored array straight back;
    // this door alone builds its payload by hand, which is precisely how it came to
    // fold while none of the others did. One fixture, one column, six doors.
    //
    // The fixture is the shape that makes the doors come apart if any of them folds:
    // three uncounted lines of identical work (a fold merges them into one) beside a
    // counted line of different work (a fold leaves it alone).
    const stored: WorkoutSet[] = [
      { id: 's1', reps: 10, weight: 100 },
      { id: 's2', reps: 10, weight: 100 },
      { id: 's3', reps: 10, weight: 100 },
      { id: 's4', reps: 8, weight: 60, count: 2 },
    ]
    const created = repo.create({ userId, exerciseId, date: '2025-01-01', sets: stored })

    const otherDoors = {
      findById: repo.findById(created.id)!.sets,
      findByDate: repo.findByDate(userId, '2025-01-01')[0].sets,
      findByDateAndExercise: repo.findByDateAndExercise(userId, '2025-01-01', exerciseId)!.sets,
      findAllByUser: repo.findAllByUser(userId)[0].sets,
      findLatestForExercise: repo.findLatestForExercise(userId, exerciseId)!.sets,
    }

    // Asserted first and on its own: the five untouched doors still say four lines,
    // so the fixture is sound and any fold reported below can only have come from
    // the door under test.
    expect(otherDoors).toStrictEqual({
      findById: stored,
      findByDate: stored,
      findByDateAndExercise: stored,
      findAllByUser: stored,
      findLatestForExercise: stored,
    })

    const historyLog = repo.findHistoryByDate(userId)[0].logs[0]
    expect(historyLog.sets).toStrictEqual(stored)
    expect(historyLog.volume).toBe(volumeOf(stored))
  })
})
