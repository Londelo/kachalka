import { test, expect } from '@playwright/test'
import type { Page, Request, Response } from '@playwright/test'

import { getTodayISO, jsDayToAppIndex } from '@/shared/utils/date'

import { ensureSchema, openE2eDatabase, wipeE2eData } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

const BASE_URL = getE2eBaseUrl()

const db = openE2eDatabase()
ensureSchema(db, process.cwd())

// TWO CLOCKS — do not "simplify" one of these away.
//
// src/app/today/page.tsx renders the routine for the *local* day
// (jsDayToAppIndex(new Date().getDay()) at :219 and :338) but stores the log
// under the *UTC* date (new Date().toISOString().split('T')[0] at :319). Near a
// UTC boundary those two disagree, and the page then shows Monday's exercises
// while writing them to Sunday's date. So the routine rows below are seeded with
// the LOCAL day and every read-back asserts the UTC date. Both come from
// @/shared/utils/date so this file can never drift from what the page does.
function routineDay(): number {
  return jsDayToAppIndex(new Date().getDay())
}

function storedDate(): string {
  return getTodayISO()
}

interface StoredSet {
  weight: number
  reps: number
}

function parseSets(raw: unknown): StoredSet[] {
  let value = raw
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth += 1) {
    value = JSON.parse(value)
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `workout_logs.sets is not an array: typeof ${typeof value} / ${JSON.stringify(raw)}`,
    )
  }

  return (value as StoredSet[]).map((set) => ({ weight: set.weight, reps: set.reps }))
}

function rowsFor(exerciseId: number): { id: number; sets: unknown }[] {
  return db
    .prepare(
      'SELECT id, sets FROM workout_logs WHERE user_id = 1 AND exercise_id = ? AND date = ?',
    )
    .all(exerciseId, storedDate()) as { id: number; sets: unknown }[]
}

function storedSets(exerciseId: number): StoredSet[] | null {
  const rows = rowsFor(exerciseId)
  return rows.length === 0 ? null : parseSets(rows[0].sets)
}

function rawSetsJson(exerciseId: number): string | null {
  const rows = rowsFor(exerciseId)
  return rows.length === 0 ? null : String(rows[0].sets)
}

function seedExerciseScheduledToday(name: string): number {
  const exerciseId = Number(
    db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, 1)').run(name).lastInsertRowid,
  )
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (1, ?, ?)').run(
    exerciseId,
    routineDay(),
  )
  return exerciseId
}

function cardFor(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

// A row carries three fields — SET, LB, REPS — and their order is the page's
// business, not this file's. Each input's accessible name is the only selector
// that survives the page reordering them, so every field is reached by name.
// Never reach across cards.
const weightInputOf = (page: Page, exerciseId: number, name: string) =>
  cardFor(page, exerciseId).getByLabel(`Weight in pounds for ${name}`)

const repsInputOf = (page: Page, exerciseId: number, name: string) =>
  cardFor(page, exerciseId).getByLabel(`Reps for ${name}`)

const countInputOf = (page: Page, exerciseId: number, name: string) =>
  cardFor(page, exerciseId).getByLabel(`Set count for ${name}`)

function errorOf(page: Page, exerciseId: number) {
  return cardFor(page, exerciseId).locator('p.text-error')
}

// ── the mount-effect pre-fill, and why every keystroke below waits for it ─────
//
// The mount effect fires getTodayExercisesAction (today/page.tsx:220) and, inside
// its .then, getTodayWorkoutsAction (:225) — whose .then calls the BARE
// setExerciseSets at :236. A bare set replaces the whole Map, so a keystroke typed
// before that continuation runs is discarded: getSets (:265) falls back to
// defaultSet() (:27, weight 0), the second fill lands on the fresh set, and the
// debounced save posts {weight: 0, reps: 5}. That clears the blank filter at :305
// and dies in validateSet (workout-entity.ts:17-21), so no row is ever written —
// and the case reads back `null` and looks like a broken write path when what
// broke was a keystroke. Under full-suite load, with a cold dev compile ahead of
// it, the window is wide enough to lose reproducibly.
//
// Nothing on the screen separates the two sides of that continuation. With no log
// stored for today the pre-fill sets the Map to an empty Map, which is what it
// already was, and viewModes 'current' is exactly what the ?? 'current' at :407
// renders anyway. The network is the only observable boundary. Both actions POST
// to /today and their Next-Action ids are per-build hashes, but their argument
// lists are not: getTodayExercisesAction takes (userId, dayOfWeek) and
// getTodayWorkoutsAction takes (userId) alone (workout-server-actions.ts:42,:71),
// and the arguments travel as the JSON request body. The single-argument call is
// therefore the strongest available proof that the pre-fill has been delivered.

const BRUNO_USER_ID = 1

interface SentSave {
  exerciseId: number
  date: string
  sets: StoredSet[]
}

interface TodaySession {
  page: Page
  saves: SentSave[]
  prefillResponses: Response[]
}

function actionArgsOf(request: Request): unknown[] | null {
  if (request.method() !== 'POST') return null

  const body = request.postData()
  if (body === null) return null

  try {
    const args: unknown = JSON.parse(body)
    return Array.isArray(args) ? args : null
  } catch {
    return null
  }
}

function isWorkoutsPrefill(request: Request): boolean {
  const args = actionArgsOf(request)
  return args !== null && args.length === 1 && args[0] === BRUNO_USER_ID
}

function saveOf(request: Request): SentSave | null {
  const args = actionArgsOf(request)
  if (args === null || args.length !== 4) return null

  const [userId, exerciseId, date, sets] = args
  if (userId !== BRUNO_USER_ID) return null
  if (typeof exerciseId !== 'number' || typeof date !== 'string' || !Array.isArray(sets)) {
    return null
  }

  return {
    exerciseId,
    date,
    sets: (sets as StoredSet[]).map((set) => ({ weight: set.weight, reps: set.reps })),
  }
}

async function signInAsBruno(page: Page): Promise<TodaySession> {
  await loginAsBruno(page)

  // Without this cookie debouncedSave bails out at today/page.tsx:298 and nothing
  // is ever written — every case below would then pass vacuously.
  const cookies = await page.context().cookies(BASE_URL)
  expect(
    cookies.some((cookie) => cookie.name === 'kachalka.userId' && cookie.value === '1'),
    'loginAsBruno must set kachalka.userId=1 before any save is relied upon',
  ).toBe(true)

  const saves: SentSave[] = []
  const prefillResponses: Response[] = []

  // Both listeners are armed before the navigation: the mount effect fires the
  // pre-fill the moment the page hydrates, so a listener armed after goto can
  // already have missed the one response everything below waits on.
  page.on('request', (request) => {
    const save = saveOf(request)
    if (save !== null) saves.push(save)
  })
  page.on('response', (response) => {
    if (isWorkoutsPrefill(response.request())) prefillResponses.push(response)
  })

  await page.goto(`${BASE_URL}/today`)

  return { page, saves, prefillResponses }
}

// A macrotask round trip through the renderer's main thread. The response
// arriving is only the network half of the pre-fill — the bare setExerciseSets at
// :236 runs in the page's own .then, after the body is read on that thread — and
// this puts every continuation already queued there ahead of the next keystroke.
// It is a drain, not a sleep: it has no duration to tune, and it cannot mask a
// slow save, because awaitStoredSets still owns that window.
function drainPageMainThread(page: Page): Promise<unknown> {
  return page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(() => setTimeout(resolve, 0), 0)),
  )
}

async function awaitMountPrefill(session: TodaySession): Promise<void> {
  await expect
    .poll(() => session.prefillResponses.length, {
      message:
        'the mount effect never delivered getTodayWorkoutsAction, so the bare ' +
        'setExerciseSets at today/page.tsx:236 is still unapplied and a keystroke ' +
        'typed now would be silently discarded',
    })
    .toBeGreaterThan(0)

  const delivered = session.prefillResponses[0]
  expect(delivered?.status(), 'getTodayWorkoutsAction must answer').toBe(200)

  await drainPageMainThread(session.page)
}

function savingIndicatorOf(page: Page, exerciseId: number) {
  return cardFor(page, exerciseId).getByText('SAVING...', { exact: true })
}

async function awaitQuietCard(
  session: TodaySession,
  exerciseId: number,
  exerciseName: string,
): Promise<void> {
  const { page } = session
  await expect(cardFor(page, exerciseId)).toBeVisible()
  await expect(weightInputOf(page, exerciseId, exerciseName)).toBeAttached()
  await expect(savingIndicatorOf(page, exerciseId)).toHaveCount(0)
}

async function typeFirstSet(
  session: TodaySession,
  exerciseId: number,
  exerciseName: string,
  weight: number,
  reps: number,
): Promise<void> {
  const { page } = session

  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, exerciseName)

  await weightInputOf(page, exerciseId, exerciseName).fill(String(weight))
  await expect(weightInputOf(page, exerciseId, exerciseName)).toHaveValue(String(weight))

  await repsInputOf(page, exerciseId, exerciseName).fill(String(reps))
  await expect(repsInputOf(page, exerciseId, exerciseName)).toHaveValue(String(reps))

  // A row is only saveable once every field parses (saveable-sets.ts:16-29), so
  // the count is part of the keystroke, not decoration: leave it blank and the
  // card refuses the line and no request is ever sent.
  await countInputOf(page, exerciseId, exerciseName).fill('1')
  await expect(countInputOf(page, exerciseId, exerciseName)).toHaveValue('1')

  // The weight is re-read after the last keystroke because the failure this file
  // exists to keep honest once looked like a missing row and was in fact a lost
  // keystroke: a pre-fill landing between the fills silently reverted the
  // weight to defaultSet()'s 0. Asserting it here names that at the keystroke
  // instead of 15 seconds later as `Received: null`.
  await expect(weightInputOf(page, exerciseId, exerciseName)).toHaveValue(String(weight))
}

async function changeWeight(
  session: TodaySession,
  exerciseId: number,
  exerciseName: string,
  weight: number,
): Promise<void> {
  const { page } = session

  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, exerciseName)

  await weightInputOf(page, exerciseId, exerciseName).fill(String(weight))
  await expect(weightInputOf(page, exerciseId, exerciseName)).toHaveValue(String(weight))
}

function savesFor(session: TodaySession, exerciseId: number): SentSave[] {
  return session.saves.filter((save) => save.exerciseId === exerciseId)
}

async function awaitStoredSets(
  session: TodaySession,
  exerciseId: number,
  expected: StoredSet[],
): Promise<void> {
  await expect
    .poll(() => storedSets(exerciseId), {
      message: `the save never reached workout_logs for exercise ${exerciseId} on ${storedDate()}`,
    })
    .toEqual(expected)

  // The poll above inspects only the stored row, so "no save ever fired" and "a
  // save fired carrying something else" are the same failure there. Pin the
  // payload the page actually put on the wire: the row counts as this keystroke's
  // row only if the page sent this keystroke's sets.
  const last = savesFor(session, exerciseId).at(-1)
  expect(
    last,
    `no logWorkoutAction was ever sent for exercise ${exerciseId}, so the row in ` +
      `workout_logs for it on ${storedDate()} was not written by this keystroke`,
  ).toBeDefined()
  expect(last?.date, 'the save went to the date the page stores under').toBe(storedDate())
  expect(last?.sets).toEqual(expected)
}

test.beforeEach(() => {
  ensureSchema(db, process.cwd())
  wipeE2eData(db)
  db.exec('DELETE FROM sqlite_sequence')
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
})

test('a typed set reaches the database through the surviving write path as exactly one row', async ({
  page,
}) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')

  const session = await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(session, exerciseA, 'Write Path Alpha', 135, 5)
  await awaitStoredSets(session, exerciseA, [{ weight: 135, reps: 5 }])

  expect(rowsFor(exerciseA)).toHaveLength(1)
  expect(storedSets(exerciseA)).toEqual([{ weight: 135, reps: 5 }])
})

test('a re-save replaces the row rather than appending a second one', async ({ page }) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')

  const session = await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(session, exerciseA, 'Write Path Alpha', 135, 5)
  await awaitStoredSets(session, exerciseA, [{ weight: 135, reps: 5 }])

  await changeWeight(session, exerciseA, 'Write Path Alpha', 185)
  await awaitStoredSets(session, exerciseA, [{ weight: 185, reps: 5 }])

  // The repository's update() survived the deletion: a second write to the same
  // (user, exercise, date) replaced the row instead of creating another one.
  expect(rowsFor(exerciseA)).toHaveLength(1)

  const raw = rawSetsJson(exerciseA) as string
  expect(raw).toContain('185')
  expect(raw).not.toContain('135')
})

test('a second exercise writes its own row and leaves the first untouched', async ({ page }) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')
  const exerciseB = seedExerciseScheduledToday('Write Path Beta')

  const session = await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await expect(cardFor(page, exerciseB)).toBeVisible()

  await typeFirstSet(session, exerciseA, 'Write Path Alpha', 135, 5)
  await awaitStoredSets(session, exerciseA, [{ weight: 135, reps: 5 }])
  const alphaBefore = rawSetsJson(exerciseA)

  await typeFirstSet(session, exerciseB, 'Write Path Beta', 95, 10)
  await awaitStoredSets(session, exerciseB, [{ weight: 95, reps: 10 }])

  expect(rowsFor(exerciseB)).toHaveLength(1)
  expect(storedSets(exerciseB)).toEqual([{ weight: 95, reps: 10 }])

  expect(rawSetsJson(exerciseA)).toBe(alphaBefore)
  expect(rowsFor(exerciseA)).toHaveLength(1)
})

test('no second write path fired — the row inventory is exactly the exercises written', async ({
  page,
}) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')
  const exerciseB = seedExerciseScheduledToday('Write Path Beta')

  const session = await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(session, exerciseA, 'Write Path Alpha', 135, 5)
  await awaitStoredSets(session, exerciseA, [{ weight: 135, reps: 5 }])

  // The re-save belongs in this case: a resurrected second write path only
  // duplicates on the SECOND write, so an inventory taken after one write per
  // exercise would stay green while the upsert was appending rows.
  await changeWeight(session, exerciseA, 'Write Path Alpha', 185)
  await awaitStoredSets(session, exerciseA, [{ weight: 185, reps: 5 }])

  await typeFirstSet(session, exerciseB, 'Write Path Beta', 95, 10)
  await awaitStoredSets(session, exerciseB, [{ weight: 95, reps: 10 }])

  const inventory = db
    .prepare(
      'SELECT user_id, exercise_id, date, COUNT(*) AS rows FROM workout_logs WHERE user_id = 1 GROUP BY user_id, exercise_id, date ORDER BY exercise_id',
    )
    .all() as { user_id: number; exercise_id: number; date: string; rows: number }[]

  const total = db.prepare('SELECT COUNT(*) AS total FROM workout_logs WHERE user_id = 1').get() as {
    total: number
  }

  expect(total.total, 'a third row is the fingerprint of a resurrected write path').toBe(2)
  expect(inventory).toEqual([
    { user_id: 1, exercise_id: exerciseA, date: storedDate(), rows: 1 },
    { user_id: 1, exercise_id: exerciseB, date: storedDate(), rows: 1 },
  ])
})

test('the page still renders after the deletion — both cards, no error, no dev overlay', async ({
  page,
}) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')
  const exerciseB = seedExerciseScheduledToday('Write Path Beta')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await signInAsBruno(page)

  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible()
  await expect(cardFor(page, exerciseA)).toBeVisible()
  await expect(cardFor(page, exerciseB)).toBeVisible()
  await expect(cardFor(page, exerciseA).getByRole('heading', { name: 'Write Path Alpha' })).toBeVisible()
  await expect(cardFor(page, exerciseB).getByRole('heading', { name: 'Write Path Beta' })).toBeVisible()

  await expect(errorOf(page, exerciseA)).toHaveCount(0)
  await expect(errorOf(page, exerciseB)).toHaveCount(0)

  // A reference to the deleted module that survived into the client bundle shows
  // up here rather than as a card.
  await expect(page.locator('nextjs-portal')).toBeHidden()
  expect(pageErrors).toEqual([])
})

test('a rejected save surfaces on the card and writes no row', async ({ page }) => {
  const exerciseC = seedExerciseScheduledToday('Write Path Rejected')

  const session = await signInAsBruno(page)

  await expect(cardFor(page, exerciseC)).toBeVisible()
  await typeFirstSet(session, exerciseC, 'Write Path Rejected', -10, 5)

  await expect(errorOf(page, exerciseC)).toBeVisible()
  await expect(errorOf(page, exerciseC)).not.toHaveText('')

  expect(rowsFor(exerciseC)).toHaveLength(0)
  expect(storedSets(exerciseC)).toBeNull()
})
