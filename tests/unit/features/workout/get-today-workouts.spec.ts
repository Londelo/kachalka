import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import { getTodayWorkoutsUseCase } from '@/features/workout/get-today-workouts'
import type { WorkoutRepository } from '@/features/workout/workout-repository'
import type { WorkoutLog } from '@/features/workout/types'

const DATE = '2025-01-01'

/**
 * The use case has zero runtime dependencies — both its imports are `import type`
 * — so a plain object literal carrying the one method it calls is a sufficient
 * repository. Nothing here mocks a module: the subject is the real use case and
 * the only fake is the port it was handed.
 */
function fakeRepo(logs: WorkoutLog[]): WorkoutRepository {
  return { findByDate: () => logs } as unknown as WorkoutRepository
}

function logFor(exerciseId: number, sets: WorkoutLog['sets']): WorkoutLog {
  return {
    id: exerciseId,
    userId: 1,
    exerciseId,
    date: DATE,
    sets,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }
}

describe('getTodayWorkoutsUseCase — the projection', () => {
  it('keys the day by exercise id and emits weight, reps and count per line', () => {
    const workouts = getTodayWorkoutsUseCase(fakeRepo([
      logFor(5, [
        { id: 's1', reps: 5, weight: 135, count: 3 },
        { id: 's2', reps: 8, weight: 95, count: 1 },
      ]),
    ])).execute(1, DATE)

    expect(workouts).toEqual({
      5: [
        { weight: 135, reps: 5, count: 3 },
        { weight: 95, reps: 8, count: 1 },
      ],
    })
  })

  it('drops the stored id and any other line field from the wire shape', () => {
    const workouts = getTodayWorkoutsUseCase(fakeRepo([
      logFor(5, [{ id: 's1', reps: 5, weight: 135, count: 3, note: 'tight bar' } as WorkoutLog['sets'][0]]),
    ])).execute(1, DATE)

    expect(workouts).toEqual({ 5: [{ weight: 135, reps: 5, count: 3 }] })
  })

  it('gives each exercise logged on the date its own key', () => {
    const workouts = getTodayWorkoutsUseCase(fakeRepo([
      logFor(7, [{ id: 's1', reps: 5, weight: 135, count: 2 }]),
      logFor(9, [{ id: 's2', reps: 8, weight: 95, count: 1 }]),
    ])).execute(1, DATE)

    expect(workouts).toEqual({
      7: [{ weight: 135, reps: 5, count: 2 }],
      9: [{ weight: 95, reps: 8, count: 1 }],
    })
  })

  it('returns an empty object when the repository finds no logs for the date', () => {
    expect(getTodayWorkoutsUseCase(fakeRepo([])).execute(1, DATE)).toEqual({})
  })

  it('keeps a logged exercise with no lines as an empty array, not a missing key', () => {
    const workouts = getTodayWorkoutsUseCase(fakeRepo([logFor(7, [])])).execute(1, DATE)

    expect(workouts).toEqual({ 7: [] })
    expect(Object.keys(workouts)).toEqual(['7'])
  })

  // The only thing this use case does with its arguments is forward them, so this
  // is the sole guard on their order. Red if execute() swaps userId and date, or
  // stops forwarding either — the read would then query the wrong commander or the
  // wrong day and every case above would still pass, since the fake ignores args.
  it('queries the repository for exactly the user and date it was given', () => {
    const findByDate = vi.fn(() => [])

    getTodayWorkoutsUseCase({ findByDate } as unknown as WorkoutRepository).execute(42, '2026-03-04')

    expect(findByDate).toHaveBeenCalledWith(42, '2026-03-04')
  })

  // Finding 1 (PR #20): the projection used to call normalizeSetCount, which
  // throws. One bad stored byte then took down the whole read, and the page fell
  // into its "no workouts today" branch — the commander's logged sets vanished
  // from the screen while still sitting in the database. Red if normalizeSetCount
  // is put back into toWireSet: this call would throw instead of returning.
  it('emits the count the repository decoded rather than re-enforcing the floor itself', () => {
    const workouts = getTodayWorkoutsUseCase(fakeRepo([
      logFor(5, [{ id: 's1', reps: 5, weight: 135, count: -5 }]),
    ])).execute(1, DATE)

    expect(workouts).toEqual({ 5: [{ weight: 135, reps: 5, count: -5 }] })
  })

  // The other half of the same fault: a genuine repository failure must not be
  // mistaken for an empty day. Red if execute() wraps findByDate in a try/catch
  // that returns {} — the two would collapse into one shape and the caller could
  // no longer tell "nothing logged" from "the read broke".
  it('propagates a repository failure instead of returning an empty day', () => {
    const repo = {
      findByDate: () => {
        throw new Error('database is locked')
      },
    } as unknown as WorkoutRepository

    expect(() => getTodayWorkoutsUseCase(repo).execute(1, DATE)).toThrow(/^database is locked$/)
  })
})

/**
 * The corrupt-stored-byte half of finding 1, driven end to end.
 *
 * workout-server-actions.spec.ts mocks the repository wholesale, so feeding it a
 * bad byte proves nothing about the decoder — the byte never passes through one.
 * These cases use the real repository over a real in-memory database, in the
 * style of workout-repo-impl.spec.ts, so the stored JSON is the only input and
 * decodeSetCount is genuinely on the path.
 */
describe('getTodayWorkoutsUseCase — a corrupt stored count read from disk', () => {
  let db: Database.Database | undefined
  let repo: WorkoutRepository

  beforeEach(() => {
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
  })

  afterEach(() => {
    if (db) db.close()
  })

  function seedStoredSets(setsJson: string): { userId: number; exerciseId: number } {
    const user = db!.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
    const exercise = db!
      .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
      .run('Squat', user.lastInsertRowid!)
    const userId = Number(user.lastInsertRowid)
    const exerciseId = Number(exercise.lastInsertRowid)

    db!.prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)').run(
      userId,
      exerciseId,
      DATE,
      setsJson,
    )

    return { userId, exerciseId }
  }

  // Red if decodeSetCount regains a throw, or if mapRowToWorkoutLog stops calling
  // it: the read would either blow up (and the page show an empty session) or hand
  // the raw byte to the wire. Each row hits a distinct branch of the decoder —
  // a finite number below the floor, a non-numeric string, a value that is neither
  // number nor string, and an absent key.
  it.each(
    [
      { label: 'a negative count', sets: '[{"id":"a","reps":5,"weight":135,"count":-5}]' },
      { label: 'a non-numeric string count', sets: '[{"id":"a","reps":5,"weight":135,"count":"abc"}]' },
      { label: 'a boolean count', sets: '[{"id":"a","reps":5,"weight":135,"count":true}]' },
      { label: 'a line with no count key at all', sets: '[{"id":"a","reps":5,"weight":135}]' },
    ],
  )('reads $label as one set instead of failing the day', ({ sets }) => {
    const { userId, exerciseId } = seedStoredSets(sets)

    const workouts = getTodayWorkoutsUseCase(repo).execute(userId, DATE)

    expect(workouts).toEqual({ [exerciseId]: [{ weight: 135, reps: 5, count: 1 }] })
  })

  // The data-loss symptom from finding 1, stated as the page sees it: a corrupt
  // byte on one line must not blank the day. Red if any read-path owner starts
  // policing stored bytes — the exercise key would disappear entirely rather than
  // come back with a count of 1.
  it('keeps the rest of the day readable when one stored line is corrupt', () => {
    const { userId, exerciseId } = seedStoredSets(
      '[{"id":"a","reps":5,"weight":135,"count":-5},{"id":"b","reps":3,"weight":95,"count":4}]',
    )

    const workouts = getTodayWorkoutsUseCase(repo).execute(userId, DATE)

    expect(workouts).toEqual({
      [exerciseId]: [
        { weight: 135, reps: 5, count: 1 },
        { weight: 95, reps: 3, count: 4 },
      ],
    })
  })
})
