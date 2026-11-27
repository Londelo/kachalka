import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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

// The weight and reps inputs carry no data-id and no label association — the
// only text near them is a sibling <span> reading "LB:" / "REPS:". Within one row
// weight comes first and reps second (today/page.tsx:136 then :148), so the
// ordered pair scoped to one card is the selector. Never reach across cards.
function weightInputOf(page: Page, exerciseId: number) {
  return cardFor(page, exerciseId).locator('input[type="number"][placeholder="0"]').nth(0)
}

function repsInputOf(page: Page, exerciseId: number) {
  return cardFor(page, exerciseId).locator('input[type="number"][placeholder="0"]').nth(1)
}

function errorOf(page: Page, exerciseId: number) {
  return cardFor(page, exerciseId).locator('p.text-error')
}

async function signInAsBruno(page: Page): Promise<void> {
  await loginAsBruno(page)

  // Without this cookie debouncedSave bails out at today/page.tsx:298 and nothing
  // is ever written — every case below would then pass vacuously.
  const cookies = await page.context().cookies(BASE_URL)
  expect(
    cookies.some((cookie) => cookie.name === 'kachalka.userId' && cookie.value === '1'),
    'loginAsBruno must set kachalka.userId=1 before any save is relied upon',
  ).toBe(true)

  await page.goto(`${BASE_URL}/today`)
}

async function typeFirstSet(
  page: Page,
  exerciseId: number,
  weight: number,
  reps: number,
): Promise<void> {
  await weightInputOf(page, exerciseId).fill(String(weight))
  await repsInputOf(page, exerciseId).fill(String(reps))
}

async function awaitStoredSets(
  page: Page,
  exerciseId: number,
  expected: StoredSet[],
): Promise<void> {
  await expect
    .poll(() => storedSets(exerciseId), {
      message: `the save never reached workout_logs for exercise ${exerciseId} on ${storedDate()}`,
    })
    .toEqual(expected)
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

  await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(page, exerciseA, 135, 5)
  await awaitStoredSets(page, exerciseA, [{ weight: 135, reps: 5 }])

  expect(rowsFor(exerciseA)).toHaveLength(1)
  expect(storedSets(exerciseA)).toEqual([{ weight: 135, reps: 5 }])
})

test('a re-save replaces the row rather than appending a second one', async ({ page }) => {
  const exerciseA = seedExerciseScheduledToday('Write Path Alpha')

  await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(page, exerciseA, 135, 5)
  await awaitStoredSets(page, exerciseA, [{ weight: 135, reps: 5 }])

  await weightInputOf(page, exerciseA).fill('185')
  await awaitStoredSets(page, exerciseA, [{ weight: 185, reps: 5 }])

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

  await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await expect(cardFor(page, exerciseB)).toBeVisible()

  await typeFirstSet(page, exerciseA, 135, 5)
  await awaitStoredSets(page, exerciseA, [{ weight: 135, reps: 5 }])
  const alphaBefore = rawSetsJson(exerciseA)

  await typeFirstSet(page, exerciseB, 95, 10)
  await awaitStoredSets(page, exerciseB, [{ weight: 95, reps: 10 }])

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

  await signInAsBruno(page)

  await expect(cardFor(page, exerciseA)).toBeVisible()
  await typeFirstSet(page, exerciseA, 135, 5)
  await awaitStoredSets(page, exerciseA, [{ weight: 135, reps: 5 }])

  await typeFirstSet(page, exerciseB, 95, 10)
  await awaitStoredSets(page, exerciseB, [{ weight: 95, reps: 10 }])

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

  await signInAsBruno(page)

  await expect(cardFor(page, exerciseC)).toBeVisible()
  await typeFirstSet(page, exerciseC, -10, 5)

  await expect(errorOf(page, exerciseC)).toBeVisible()
  await expect(errorOf(page, exerciseC)).not.toHaveText('')

  expect(rowsFor(exerciseC)).toHaveLength(0)
  expect(storedSets(exerciseC)).toBeNull()
})
