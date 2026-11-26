import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import { createSqliteChartRepository } from '@/features/chart/chart-repo-impl'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import { calculateVolume } from '@/features/workout/workout-entity'
import type { WorkoutSet } from '@/features/workout/types'

const connection: { db: Database.Database | undefined } = { db: undefined }

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => connection.db),
  resetDatabase: vi.fn(),
  db: undefined,
}))

const TODAY = '2026-03-04'
const MONDAY = 0
const EMPTY_TABLE_MESSAGE = 'Must log at least one set'

let db: Database.Database
let workoutRepo: ReturnType<typeof createSqliteWorkoutRepository>
let routineRepo: ReturnType<typeof createSqliteRoutineRepository>
let exerciseRepo: ReturnType<typeof createSqliteExerciseRepository>
let chartRepo: ReturnType<typeof createSqliteChartRepository>
let userId: number
let exerciseId: number

function applyRealMigrations(target: Database.Database): void {
  const migrationsDir = path.join(process.cwd(), 'src', 'db', 'migrations')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    throw new Error(`No .sql migrations found in ${migrationsDir}`)
  }

  for (const file of files) {
    target.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'))
  }
}

function resetDb(): void {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyRealMigrations(db)
  connection.db = db

  workoutRepo = createSqliteWorkoutRepository(db)
  routineRepo = createSqliteRoutineRepository(db)
  exerciseRepo = createSqliteExerciseRepository(db)
  chartRepo = createSqliteChartRepository(db)

  userId = Number(
    db.prepare('INSERT INTO users (name) VALUES (?)').run('Bruno').lastInsertRowid,
  )
  exerciseId = Number(
    db
      .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
      .run('Bench Press', userId).lastInsertRowid,
  )
}

function assignToMonday(): void {
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(
    userId,
    exerciseId,
    MONDAY,
  )
}

function writeThroughTheRealPath(sets: WorkoutSet[]): void {
  logWorkoutUseCase(workoutRepo).execute(userId, exerciseId, TODAY, sets)
}

function insertLegacyRow(lines: { id: string; reps: number; weight: number }[]): void {
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
  ).run(userId, exerciseId, TODAY, JSON.stringify(JSON.stringify(lines)))
}

function storedRowCount(): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM workout_logs').get() as { c: number }).c
}

function rawStoredSets(): string {
  return (
    db
      .prepare('SELECT sets FROM workout_logs WHERE user_id = ? AND exercise_id = ? AND date = ?')
      .get(userId, exerciseId, TODAY) as { sets: string }
  ).sets
}

async function volumeFromEveryReader(): Promise<Record<string, number>> {
  const byDateAndExercise = workoutRepo.findByDateAndExercise(userId, TODAY, exerciseId)
  const byUser = workoutRepo.findAllByUser(userId)
  const history = workoutRepo.findHistoryByDate(userId)
  const today = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo).execute(
    userId,
    MONDAY,
  )[0]
  const chartPoints = chartRepo.getVolumeByDate(userId, exerciseId, 'ALL')
  const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
  const workouts = (await getTodayWorkoutsAction(userId)).workouts

  return {
    findByDateAndExercise: calculateVolume(byDateAndExercise!.sets),
    findAllByUser: calculateVolume(byUser[0]!.sets),
    findHistoryByDate: history[0]!.logs[0]!.volume,
    getTodayExercisesUseCase: calculateVolume(today!.lastLog!),
    getTodayWorkoutsAction: calculateVolume(workouts![exerciseId]!),
    chartGetVolumeByDate: chartPoints[0]!.volume,
    chartGetPeakVolume: chartRepo.getPeakVolume(userId, exerciseId),
  }
}

async function countFromEveryReader(): Promise<Record<string, number | undefined>> {
  const byDateAndExercise = workoutRepo.findByDateAndExercise(userId, TODAY, exerciseId)
  const byUser = workoutRepo.findAllByUser(userId)
  const history = workoutRepo.findHistoryByDate(userId)
  const today = getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo).execute(
    userId,
    MONDAY,
  )[0]
  const chartPoints = chartRepo.getVolumeByDate(userId, exerciseId, 'ALL')
  const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
  const workouts = (await getTodayWorkoutsAction(userId)).workouts

  return {
    findByDateAndExercise: byDateAndExercise!.sets[0]!.count,
    findAllByUser: byUser[0]!.sets[0]!.count,
    findHistoryByDate: history[0]!.logs[0]!.sets[0]!.count,
    getTodayExercisesUseCase: today!.lastLog![0]!.count,
    getTodayWorkoutsAction: workouts![exerciseId]![0]!.count,
    chartGetVolumeByDate: chartPoints[0]!.sets[0]!.count,
  }
}

function storedLines(): WorkoutSet[] {
  return JSON.parse(JSON.parse(rawStoredSets())) as WorkoutSet[]
}

function sourceFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? sourceFilesUnder(full) : /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function matchingLines(content: string, pattern: RegExp, label: string): string[] {
  return content
    .split('\n')
    .map((line, index) => `${label}:${index + 1}: ${line.trim()}`)
    .filter((line) => pattern.test(line))
}

function linesMatching(file: string, pattern: RegExp): string[] {
  return matchingLines(
    fs.readFileSync(file, 'utf-8'),
    pattern,
    path.relative(process.cwd(), file),
  )
}

function offendersUnder(dir: string, pattern: RegExp): string[] {
  return sourceFilesUnder(dir).flatMap((file) => linesMatching(file, pattern))
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00.000Z`), toFake: ['Date'] })
  resetDb()
  assignToMonday()
})

afterEach(() => {
  vi.useRealTimers()
  connection.db = undefined
  db.close()
})

describe('journey 1 — one counted write, every reader agrees', () => {
  beforeEach(() => {
    writeThroughTheRealPath([{ id: 's1', reps: 5, weight: 135, count: 3 }])
  })

  it('reports volume 2025 out of every door the feature touched', async () => {
    expect(await volumeFromEveryReader()).toEqual({
      findByDateAndExercise: 2025,
      findAllByUser: 2025,
      findHistoryByDate: 2025,
      getTodayExercisesUseCase: 2025,
      getTodayWorkoutsAction: 2025,
      chartGetVolumeByDate: 2025,
      chartGetPeakVolume: 2025,
    })
  })

  it('reports a count of 3 out of every door the feature touched', async () => {
    expect(await countFromEveryReader()).toEqual({
      findByDateAndExercise: 3,
      findAllByUser: 3,
      findHistoryByDate: 3,
      getTodayExercisesUseCase: 3,
      getTodayWorkoutsAction: 3,
      chartGetVolumeByDate: 3,
    })
  })
})

describe('journey 2 — legacy equivalence, the no-regression spine', () => {
  beforeEach(() => {
    insertLegacyRow([{ id: 's1', reps: 5, weight: 135 }])
  })

  it('reports the pre-change volume 675 out of every door', async () => {
    expect(await volumeFromEveryReader()).toEqual({
      findByDateAndExercise: 675,
      findAllByUser: 675,
      findHistoryByDate: 675,
      getTodayExercisesUseCase: 675,
      getTodayWorkoutsAction: 675,
      chartGetVolumeByDate: 675,
      chartGetPeakVolume: 675,
    })
  })

  it('leaves a legacy line’s count absent rather than stamped with 1 on every verbatim door', async () => {
    const counts = await countFromEveryReader()

    expect(counts.findByDateAndExercise).toBeUndefined()
    expect(counts.findAllByUser).toBeUndefined()
    expect(counts.getTodayExercisesUseCase).toBeUndefined()
    expect(counts.getTodayWorkoutsAction).toBeUndefined()
    expect(counts.chartGetVolumeByDate).toBeUndefined()
  })

  it('publishes the collapse tally 1 only where the line is folded, and still reports 675', () => {
    const history = workoutRepo.findHistoryByDate(userId)

    expect(history[0]!.logs[0]!.sets).toEqual([{ id: 's1', reps: 5, weight: 135, count: 1 }])
    expect(history[0]!.logs[0]!.volume).toBe(675)
  })

  it('leaves the external Playwright witness naming the three pre-change volumes', () => {
    const witness = fs.readFileSync(
      path.join(process.cwd(), 'tests', 'e2e', 'history-page.spec.ts'),
      'utf-8',
    )

    expect(witness).toContain("'4,560'")
    expect(witness).toContain("'2,875'")
    expect(witness).toContain("'3,225'")
  })
})

describe('journey 3 — the collapse journey', () => {
  it('stores two lines of the same work as one line of count 4 and reports it identically everywhere', async () => {
    writeThroughTheRealPath([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 5, weight: 100, count: 2 },
    ])

    expect(storedLines()).toEqual([{ id: 'a', reps: 5, weight: 100, count: 4 }])
    expect(await volumeFromEveryReader()).toEqual({
      findByDateAndExercise: 2000,
      findAllByUser: 2000,
      findHistoryByDate: 2000,
      getTodayExercisesUseCase: 2000,
      getTodayWorkoutsAction: 2000,
      chartGetVolumeByDate: 2000,
      chartGetPeakVolume: 2000,
    })
    expect(await countFromEveryReader()).toEqual({
      findByDateAndExercise: 4,
      findAllByUser: 4,
      findHistoryByDate: 4,
      getTodayExercisesUseCase: 4,
      getTodayWorkoutsAction: 4,
      chartGetVolumeByDate: 4,
    })
  })

  it('keeps two lines of different work as two lines, in every door', async () => {
    writeThroughTheRealPath([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 8, weight: 60, count: 3 },
    ])

    expect(storedLines()).toEqual([
      { id: 'a', reps: 5, weight: 100, count: 2 },
      { id: 'b', reps: 8, weight: 60, count: 3 },
    ])

    const { getTodayWorkoutsAction } = await import('@/features/workout/workout-server-actions')
    const workouts = (await getTodayWorkoutsAction(userId)).workouts

    expect(workoutRepo.findByDateAndExercise(userId, TODAY, exerciseId)!.sets).toHaveLength(2)
    expect(workoutRepo.findAllByUser(userId)[0]!.sets).toHaveLength(2)
    expect(workoutRepo.findHistoryByDate(userId)[0]!.logs[0]!.sets).toHaveLength(2)
    expect(
      getTodayExercisesUseCase(routineRepo, workoutRepo, exerciseRepo).execute(userId, MONDAY)[0]!
        .lastLog,
    ).toHaveLength(2)
    expect(chartRepo.getVolumeByDate(userId, exerciseId, 'ALL')[0]!.sets).toHaveLength(2)
    expect(workouts![exerciseId]).toHaveLength(2)
  })
})

describe('journey 4 — the refusal journey', () => {
  it('refuses a count of 0 by name, never with the empty-array message, and stores nothing', () => {
    expect(() =>
      writeThroughTheRealPath([{ id: 'a', reps: 5, weight: 100, count: 0 }]),
    ).toThrow(/^Set count must be at least 1/)

    try {
      writeThroughTheRealPath([{ id: 'a', reps: 5, weight: 100, count: 0 }])
    } catch (e) {
      const message = (e as Error).message
      expect(message).not.toBe(EMPTY_TABLE_MESSAGE)
      expect(message.toLowerCase()).toContain('set count')
    }

    expect(storedRowCount()).toBe(0)
  })

  it('refuses a weight of 0 by name, never with the empty-array message, and stores nothing', () => {
    let message = ''

    try {
      writeThroughTheRealPath([{ id: 'a', reps: 5, weight: 0 }])
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toMatch(/^Weight must be more than 0/)
    expect(message).not.toBe(EMPTY_TABLE_MESSAGE)
    expect(message.toLowerCase()).toContain('weight')
    expect(storedRowCount()).toBe(0)
  })

  it('refuses a reps of 0 by name, never with the empty-array message, and stores nothing', () => {
    let message = ''

    try {
      writeThroughTheRealPath([{ id: 'a', reps: 0, weight: 100 }])
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toMatch(/^Reps must be more than 0/)
    expect(message).not.toBe(EMPTY_TABLE_MESSAGE)
    expect(message.toLowerCase()).toContain('reps')
    expect(storedRowCount()).toBe(0)
  })

  it('names three different fields with three different messages', () => {
    const messageFor = (set: WorkoutSet): string => {
      try {
        writeThroughTheRealPath([set])
      } catch (e) {
        return (e as Error).message
      }
      throw new Error('expected a refusal')
    }

    const messages = [
      messageFor({ id: 'a', reps: 5, weight: 100, count: 0 }),
      messageFor({ id: 'a', reps: 5, weight: 0 }),
      messageFor({ id: 'a', reps: 0, weight: 100 }),
    ]

    expect(new Set(messages).size).toBe(3)
    expect(storedRowCount()).toBe(0)
  })

  it('validates the raw lines before any folding, so an illegal count in a non-empty array answers with the count message', () => {
    let message = ''

    try {
      writeThroughTheRealPath([
        { id: 'a', reps: 5, weight: 100 },
        { id: 'b', reps: 5, weight: 100, count: -1 },
      ])
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toBe(
      'Set count must be at least 1 — enter how many sets you did, or leave it blank for one.',
    )
    expect(message).not.toBe(EMPTY_TABLE_MESSAGE)
    expect(storedRowCount()).toBe(0)
  })
})

describe('journey 5 — the fractional journey', () => {
  it('floors a count of 2.7 to 2 in the stored line and in every door’s volume', async () => {
    writeThroughTheRealPath([{ id: 's1', reps: 5, weight: 135, count: 2.7 }])

    expect(storedLines()).toEqual([{ id: 's1', reps: 5, weight: 135, count: 2 }])
    expect(await volumeFromEveryReader()).toEqual({
      findByDateAndExercise: 1350,
      findAllByUser: 1350,
      findHistoryByDate: 1350,
      getTodayExercisesUseCase: 1350,
      getTodayWorkoutsAction: 1350,
      chartGetVolumeByDate: 1350,
      chartGetPeakVolume: 1350,
    })
    expect(await countFromEveryReader()).toEqual({
      findByDateAndExercise: 2,
      findAllByUser: 2,
      findHistoryByDate: 2,
      getTodayExercisesUseCase: 2,
      getTodayWorkoutsAction: 2,
      chartGetVolumeByDate: 2,
    })
  })

  it('floors each 2.5 line before summing them, so the collapse is 4 sets and not 5', () => {
    writeThroughTheRealPath([
      { id: 'a', reps: 5, weight: 100, count: 2.5 },
      { id: 'b', reps: 5, weight: 100, count: 2.5 },
    ])

    expect(storedLines()).toEqual([{ id: 'a', reps: 5, weight: 100, count: 4 }])
    expect(workoutRepo.findHistoryByDate(userId)[0]!.logs[0]!.volume).toBe(2000)
    expect(chartRepo.getPeakVolume(userId, exerciseId)).toBe(2000)
  })
})

describe('journey 6 — the persistence proof', () => {
  it('stores the count verbatim in the column, one unwrap below the double-encoded surface', () => {
    writeThroughTheRealPath([{ id: 's1', reps: 5, weight: 135, count: 3 }])

    const oneLayerUnwrapped = JSON.parse(rawStoredSets()) as string

    expect(typeof oneLayerUnwrapped).toBe('string')
    expect(oneLayerUnwrapped).toContain('"count":3')
    expect(oneLayerUnwrapped).not.toContain('"count":1')
    expect(oneLayerUnwrapped).not.toContain('"reps":15')

    const parsed = JSON.parse(oneLayerUnwrapped) as WorkoutSet[]

    expect(Object.keys(parsed[0]!)).toContain('count')
    expect(parsed).toEqual([{ id: 's1', reps: 5, weight: 135, count: 3 }])
  })
})

describe('journey 7 — the single-owner bar', () => {
  it('finds the volume multiply in the scanner when it is present, so an empty result means something', () => {
    expect(matchingLines('const v = reps * weight', /reps \* /, 'control')).toEqual([
      'control:1: const v = reps * weight',
    ])
    expect(matchingLines('const v = weight * reps', /reps \* /, 'control')).toEqual([])
  })

  it('leaves no second copy of the volume arithmetic anywhere under src/features', () => {
    expect(offendersUnder(path.join(process.cwd(), 'src', 'features'), /reps \* /)).toEqual([])
  })

  it('never uses sets.length as a set count under src/features', () => {
    const nonGuardUses = offendersUnder(
      path.join(process.cwd(), 'src', 'features'),
      /sets\.length/,
    ).filter((line) => !/sets\.length === 0/.test(line))

    expect(nonGuardUses).toEqual([])
  })
})
