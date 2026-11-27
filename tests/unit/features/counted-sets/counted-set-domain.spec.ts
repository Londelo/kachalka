import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import * as R from 'ramda'
import { createSqliteWorkoutRepository } from '@/features/workout/workout-repo-impl'
import { createSqliteRoutineRepository } from '@/features/routine/routine-repo-impl'
import { createSqliteExerciseRepository } from '@/features/exercise/exercise-repo-impl'
import { createSqliteChartRepository } from '@/features/chart/chart-repo-impl'
import { logWorkoutUseCase } from '@/features/workout/log-workout'
import { getTodayExercisesUseCase } from '@/features/workout/get-today-exercises'
import { calculateVolume, getSetCount } from '@/features/workout/workout-entity'
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

function clearStoredLogs(): void {
  db.prepare('DELETE FROM workout_logs').run()
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

/**
 * Everything a door says about *how many sets* it handed back.
 *
 * The three fields are three separate accusations, and only two of them used to
 * exist. Sampling `sets[0].count` — the old shape of this helper — asks one line
 * what its own tally is, and a door that folded three sets of ten into a single
 * line answers `3` and walks free while the War Logs page renders `SETS 1`.
 *
 * `totalSets` is the aggregate the feature promises the lifter: the counts of
 * every line, summed the way `calculateVolume` sums them for volume. A door that
 * throws lines away — or folds them and loses the tally — comes out short here.
 * `lineCount` is how many lines actually arrived. A door that folds identical
 * lines keeps `totalSets` exact and still reports the wrong `lineCount`, which is
 * the only way a fold that faithfully carries the tally gets caught.
 * `firstCount` is the per-line field, kept as its own assertion so a legacy line
 * that must stay un-stamped stays proven un-stamped.
 */
type DoorReading = {
  totalSets: number
  lineCount: number
  firstCount: number | undefined
}

function readDoor(sets: WorkoutSet[]): DoorReading {
  return {
    totalSets: R.sum(R.map(getSetCount, sets)),
    lineCount: sets.length,
    firstCount: sets[0]?.count,
  }
}

/**
 * The War Logs session card's own two tallies, restated here from the one shared
 * read rule so this file can pin the numbers the page renders without importing a
 * client component.
 *
 * They are `calcSetTotal` (src/app/history/HistoryPageClient.tsx:34) and
 * `calcRepTotal` (:45), and both are built on `getSetCount` — never on
 * `sets.length`, never on a bare `reps`. A test that reached for those two
 * expressions instead was asserting a formula the page no longer runs, which is
 * how the count-blind page kept its green suite while the browser showed `SETS 1`
 * for a session of three. Writing the tallies through `getSetCount` is what makes
 * the assertions below able to fail.
 */
function calcSetTotal(lines: WorkoutSet[]): number {
  return R.sum(R.map(getSetCount, lines))
}

function calcRepTotal(lines: WorkoutSet[]): number {
  return R.sum(R.map((line) => getSetCount(line) * line.reps, lines))
}

async function countFromEveryReader(): Promise<Record<string, DoorReading>> {
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
    findByDateAndExercise: readDoor(byDateAndExercise!.sets),
    findAllByUser: readDoor(byUser[0]!.sets),
    findHistoryByDate: readDoor(history[0]!.logs[0]!.sets),
    getTodayExercisesUseCase: readDoor(today!.lastLog!),
    getTodayWorkoutsAction: readDoor(workouts![exerciseId]!),
    chartGetVolumeByDate: readDoor(chartPoints[0]!.sets),
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

  it('reports three sets out of every door the feature touched, as one line carrying the tally 3', async () => {
    // The three fields are three separate claims about the same write: the door
    // sums to three sets, it handed back exactly one line to do it, and that line
    // owns the tally itself. A door free to drop two of three lines still answers
    // `3` if only the surviving line is asked.
    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 3, lineCount: 1, firstCount: 3 },
      findAllByUser: { totalSets: 3, lineCount: 1, firstCount: 3 },
      findHistoryByDate: { totalSets: 3, lineCount: 1, firstCount: 3 },
      getTodayExercisesUseCase: { totalSets: 3, lineCount: 1, firstCount: 3 },
      getTodayWorkoutsAction: { totalSets: 3, lineCount: 1, firstCount: 3 },
      chartGetVolumeByDate: { totalSets: 3, lineCount: 1, firstCount: 3 },
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

  it('leaves a legacy line’s count absent rather than stamped with 1 on every door, and still reads it as one set', async () => {
    // `findHistoryByDate` is in this list now because it can be: the door used to
    // fold on the way out, which stamped a synthesised `count: 1` onto a line the
    // lifter never gave a count, and forced this assertion to except the one door
    // the War Logs page actually reads.
    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 1, lineCount: 1, firstCount: undefined },
      findAllByUser: { totalSets: 1, lineCount: 1, firstCount: undefined },
      findHistoryByDate: { totalSets: 1, lineCount: 1, firstCount: undefined },
      getTodayExercisesUseCase: { totalSets: 1, lineCount: 1, firstCount: undefined },
      getTodayWorkoutsAction: { totalSets: 1, lineCount: 1, firstCount: undefined },
      chartGetVolumeByDate: { totalSets: 1, lineCount: 1, firstCount: undefined },
    })
  })

  it('publishes the legacy line verbatim through the history door, with the pre-change volume and set total', () => {
    const history = workoutRepo.findHistoryByDate(userId)
    const lines = history[0]!.logs[0]!.sets

    expect(lines).toEqual([{ id: 's1', reps: 5, weight: 135 }])
    expect(history[0]!.logs[0]!.volume).toBe(675)
    expect(R.sum(R.map(getSetCount, lines))).toBe(1)
  })

  it('hands three identical legacy lines back as three lines to every door, so the set total the page sums is 3', async () => {
    // The shape the counted-set domain must survive, and the one the browser caught
    // when it did not. The write path folds identical lines before it stores, so a
    // row holding three of them can only be legacy data — exactly what the Playwright
    // fixture at tests/e2e/history-page.spec.ts:169 writes, three uncounted
    // `{ reps: 10, weight: 100 }` lines for one exercise. A read door that folded
    // them reported `SETS 1` for what the lifter logged as three sets, and the old
    // helper could not see it: it asked the surviving line for its tally, got `3`,
    // and passed. `lineCount` is what a faithful fold cannot talk its way past.
    clearStoredLogs()
    insertLegacyRow([
      { id: 's1', reps: 10, weight: 100 },
      { id: 's2', reps: 10, weight: 100 },
      { id: 's3', reps: 10, weight: 100 },
    ])

    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 3, lineCount: 3, firstCount: undefined },
      findAllByUser: { totalSets: 3, lineCount: 3, firstCount: undefined },
      findHistoryByDate: { totalSets: 3, lineCount: 3, firstCount: undefined },
      getTodayExercisesUseCase: { totalSets: 3, lineCount: 3, firstCount: undefined },
      getTodayWorkoutsAction: { totalSets: 3, lineCount: 3, firstCount: undefined },
      chartGetVolumeByDate: { totalSets: 3, lineCount: 3, firstCount: undefined },
    })
  })

  it('publishes the history door’s own numbers for the session the browser renders, so the page has 4,560 / 6 / 54 to show', () => {
    // The claim the deleted Playwright-source witness only pretended to make. That
    // test read tests/e2e/history-page.spec.ts as a string and checked three
    // literals appeared in it — unfailable, and blind to what the app renders. The
    // feature tier's real claim is the contract underneath the page: HistoryPageClient
    // sums `log.volume`, `calcSetTotal(log.sets)` and `calcRepTotal(log.sets)` across
    // the logs this door publishes (src/app/history/HistoryPageClient.tsx:136-138), so
    // pinning those three aggregates here is what proves the browser has the right
    // numbers to render. The browser's own rendering is the e2e tier's claim, and
    // tests/e2e/history-page.spec.ts:193-195 makes it green.
    //
    // This is the LEGACY half of that contract, and it is uncounted on purpose: three
    // lines of identical work per exercise, no `count` key anywhere, so here line
    // count happens to equal set count and reps-per-line happens to equal total reps.
    // 6 and 54 are therefore right under either dialect, and this fixture alone can
    // never tell them apart — which is exactly why it once certified a page that was
    // counting lines. The counted session beside it is what makes these same three
    // numbers falsifiable. Its values stay pinned at 4,560 / 6 / 54 because they are
    // the numbers the pre-change page showed and the Playwright suite still expects.
    clearStoredLogs()

    // `exerciseId` is already this user's 'Bench Press' (resetDb); `exercises.name`
    // is unique, so the session's second exercise is the only one that needs minting.
    const pressId = Number(
      db
        .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
        .run('Overhead Press', userId).lastInsertRowid,
    )

    db.prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)').run(
      userId,
      exerciseId,
      TODAY,
      JSON.stringify([
        { id: 'b1', reps: 10, weight: 100 },
        { id: 'b2', reps: 10, weight: 100 },
        { id: 'b3', reps: 10, weight: 100 },
      ]),
    )
    db.prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)').run(
      userId,
      pressId,
      TODAY,
      JSON.stringify([
        { id: 'p1', reps: 8, weight: 65 },
        { id: 'p2', reps: 8, weight: 65 },
        { id: 'p3', reps: 8, weight: 65 },
      ]),
    )

    const session = workoutRepo.findHistoryByDate(userId)[0]!

    expect(session.logs).toHaveLength(2)
    expect(R.sum(R.map((log) => log.volume, session.logs))).toBe(4560)
    expect(R.sum(R.map((log) => calcSetTotal(log.sets), session.logs))).toBe(6)
    expect(R.sum(R.map((log) => calcRepTotal(log.sets), session.logs))).toBe(54)
  })

  it('publishes the same three aggregates for a counted session whose two lines stand for five sets, so the page has 4,040 / 5 / 46 to show', () => {
    // The half of the contract the uncounted session above could never test, and the
    // one the browser caught while this file did not. There, 6 sets and 54 reps are
    // right whether a reader sums counts or counts lines, so a count-blind page was
    // certified by it. Here the two dialects answer differently: two exercises, ONE
    // stored line each, each line standing for several sets. One line carrying a count
    // is precisely what the write path produces — it folds identical lines before it
    // stores — and it is the shape the trace witnessed out of this very door
    // (`[{id:'s1',reps:5,weight:135,count:3}]`, volume 2025).
    //
    // The first four assertions are the conjunction, and the conjunction is the point:
    // ONE line, THREE sets, THIRTY reps, THREE THOUSAND volume, all four read off the
    // same array the door handed back. Each one indicts a different thief, witnessed by
    // mutation: a reader that counts lines reports 1 where 3 is right; one that reads
    // `reps` once per line reports 10 where 30 is right; and a read path that stamps
    // `count: 1` onto every line breaks the two tallies while `volume` — computed from
    // the untouched lines — stays honest at 3000. That last one is the F1 shape itself
    // (a bar of 2,025 beside a modal of 675), and it is why the volume is asserted in
    // the same breath as the tallies rather than instead of them. The session sums below
    // repeat the same test across both exercises, so a door that drops a log is caught too.
    //
    // What this fixture deliberately does NOT catch: a read that folds identically-stored
    // lines. One line is already one line, so a faithful fold is a no-op here. That
    // defect is owned by the three-identical-legacy-lines test above and by
    // tests/unit/features/workout/workout-repo-impl.spec.ts; duplicating it here would
    // only make this test fail for someone else's reason.
    clearStoredLogs()

    // `exerciseId` is already this user's 'Bench Press' (resetDb); `exercises.name`
    // is unique, so the session's second exercise is the only one that needs minting.
    const pressId = Number(
      db
        .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
        .run('Overhead Press', userId).lastInsertRowid,
    )

    // A raw INSERT rather than the write path, because this is a read test: the lines
    // are stored in the shape a logged session already holds them, so the door is
    // graded on a fold it did not perform itself.
    db.prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)').run(
      userId,
      exerciseId,
      TODAY,
      JSON.stringify([{ id: 'c1', reps: 10, weight: 100, count: 3 }]),
    )
    db.prepare('INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)').run(
      userId,
      pressId,
      TODAY,
      JSON.stringify([{ id: 'c2', reps: 8, weight: 65, count: 2 }]),
    )

    const session = workoutRepo.findHistoryByDate(userId)[0]!
    const bench = session.logs.find((log) => log.exerciseId === exerciseId)!

    expect(bench.sets).toHaveLength(1)
    expect(R.sum(R.map(getSetCount, bench.sets))).toBe(3)
    expect(R.sum(R.map((line) => getSetCount(line) * line.reps, bench.sets))).toBe(30)
    expect(bench.volume).toBe(3000)

    // The second line, pinned verbatim: the session tallies below are the sum over
    // both, so the one that is not the conjunction's own subject is pinned as stored
    // bytes rather than trusted. Selected by `exerciseId`, not by position — this test
    // is about how many sets arrived, not about which door row came first.
    const press = session.logs.find((log) => log.exerciseId === pressId)!

    expect(press.sets).toStrictEqual([{ id: 'c2', reps: 8, weight: 65, count: 2 }])

    // The three figures the session card renders, across both exercises. Two lines
    // carry five sets and forty-six reps; the count-blind page rendered 2 and 18 here.
    expect(session.logs).toHaveLength(2)
    expect(R.sum(R.map((log) => log.volume, session.logs))).toBe(4040)
    expect(R.sum(R.map((log) => calcSetTotal(log.sets), session.logs))).toBe(5)
    expect(R.sum(R.map((log) => calcRepTotal(log.sets), session.logs))).toBe(46)
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
    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 4, lineCount: 1, firstCount: 4 },
      findAllByUser: { totalSets: 4, lineCount: 1, firstCount: 4 },
      findHistoryByDate: { totalSets: 4, lineCount: 1, firstCount: 4 },
      getTodayExercisesUseCase: { totalSets: 4, lineCount: 1, firstCount: 4 },
      getTodayWorkoutsAction: { totalSets: 4, lineCount: 1, firstCount: 4 },
      chartGetVolumeByDate: { totalSets: 4, lineCount: 1, firstCount: 4 },
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

    // The lengths above say the lines arrived; this says their tallies did. Two
    // lines of different work is the one fixture where the two claims come apart:
    // a door that reads line one honestly (`count: 2`) and then quietly downgrades
    // every line after it reads two lines, first count 2, and a set total of 2
    // instead of 5. Sampling `sets[0].count` — the old shape of the helper — saw
    // the honest `2` and passed. Only the sum across all lines can see the theft.
    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 5, lineCount: 2, firstCount: 2 },
      findAllByUser: { totalSets: 5, lineCount: 2, firstCount: 2 },
      findHistoryByDate: { totalSets: 5, lineCount: 2, firstCount: 2 },
      getTodayExercisesUseCase: { totalSets: 5, lineCount: 2, firstCount: 2 },
      getTodayWorkoutsAction: { totalSets: 5, lineCount: 2, firstCount: 2 },
      chartGetVolumeByDate: { totalSets: 5, lineCount: 2, firstCount: 2 },
    })
  })
})

describe('journey 4 — the refusal journey', () => {
  it('refuses an empty table by name, and stores nothing', () => {
    let message = ''

    try {
      writeThroughTheRealPath([])
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toBe(EMPTY_TABLE_MESSAGE)
    expect(storedRowCount()).toBe(0)
  })

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
    expect(await countFromEveryReader()).toStrictEqual({
      findByDateAndExercise: { totalSets: 2, lineCount: 1, firstCount: 2 },
      findAllByUser: { totalSets: 2, lineCount: 1, firstCount: 2 },
      findHistoryByDate: { totalSets: 2, lineCount: 1, firstCount: 2 },
      getTodayExercisesUseCase: { totalSets: 2, lineCount: 1, firstCount: 2 },
      getTodayWorkoutsAction: { totalSets: 2, lineCount: 1, firstCount: 2 },
      chartGetVolumeByDate: { totalSets: 2, lineCount: 1, firstCount: 2 },
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

  it('leaves no second copy of the volume arithmetic anywhere under src', () => {
    expect(offendersUnder(path.join(process.cwd(), 'src'), /reps \* /)).toEqual([])
  })

  it('never uses sets.length as a set count anywhere under src', () => {
    const nonGuardUses = offendersUnder(path.join(process.cwd(), 'src'), /sets\.length/).filter(
      (line) => !/sets\.length\s*(===|>)\s*0/.test(line),
    )

    expect(nonGuardUses).toEqual([])
  })
})
