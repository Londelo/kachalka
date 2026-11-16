import Database from 'better-sqlite3'
import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'
import { getTodayISO, jsDayToAppIndex } from '@/shared/utils/date'
import { logWorkoutAction } from '@/features/workout/workout-server-actions'

// ============================================================================
// Feature: Typed Set Count — Today's Battle
//
// Proves the count travels the whole wire: the SET box on the exercise card,
// through logWorkoutAction, into the JSON sets column, back out through
// getTodayWorkoutsAction, and onto the rendered line again — plus every error
// and success this feature encapsulates surfacing on the commander's card.
//
// Two entry points are driven, because the feature has two:
//   * the browser, for everything a commander can actually do to the box;
//   * logWorkoutAction itself, for the junk a `type="number"` input can never
//     deliver but a `'use server'` entry point accepts from any client.
// ============================================================================

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

db.exec('DELETE FROM workout_logs')
db.exec('DELETE FROM user_routines')
db.exec('DELETE FROM exercises')
db.exec('DELETE FROM users')
db.exec('DELETE FROM sqlite_sequence')

// ============================================================================
// Seams
//
// The date and the day index come from the same functions the page calls
// (src/shared/utils/date.ts). A copy of that arithmetic here would let this
// spec seed and assert under one date while the app wrote another.
// ============================================================================

type StoredLine = { count: number | null; weight: number; reps: number }

function readRawSets(exerciseId: number): Record<string, unknown>[] | null {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = 1 AND exercise_id = ? AND date = ?')
    .get(exerciseId, getTodayISO()) as { sets: string } | undefined
  if (!row) return null
  return parseSetsColumn(row.sets)
}

/** The column is Drizzle text/json — a string written in comes back wrapped once more. */
function parseSetsColumn(column: string): Record<string, unknown>[] {
  let parsed: unknown = JSON.parse(column)
  if (typeof parsed === 'string') parsed = JSON.parse(parsed)
  if (!Array.isArray(parsed)) throw new Error(`unexpected sets column: ${column.slice(0, 120)}`)
  return parsed as Record<string, unknown>[]
}

function readStoredSets(exerciseId: number): StoredLine[] | null {
  const raw = readRawSets(exerciseId)
  if (!raw) return null
  return raw.map((line) => ({
    count: (line.count as number | undefined) ?? null,
    weight: line.weight as number,
    reps: line.reps as number,
  }))
}

function seedExerciseOnToday(name: string): number {
  const info = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, 1)').run(name)
  const exerciseId = Number(info.lastInsertRowid)
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (1, ?, ?)').run(
    exerciseId,
    jsDayToAppIndex(new Date().getDay()),
  )
  return exerciseId
}

function seedTodayLog(exerciseId: number, lines: Record<string, unknown>[]): void {
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (1, ?, ?, ?)',
  ).run(exerciseId, getTodayISO(), JSON.stringify(lines))
}

async function expectStoredSets(exerciseId: number, expected: StoredLine[]): Promise<void> {
  await expect
    .poll(() => readStoredSets(exerciseId), { timeout: 30000, message: `stored lines for exercise ${exerciseId}` })
    .toEqual(expected)
}

// ============================================================================
// Locators — every box by its own data-id, the row by the whole named triple
//
// The three data-ids are the selector contract (src/app/today/page.tsx):
//   set-count-input-<E>-<I> / set-weight-input-<E>-<I> / set-reps-input-<E>-<I>
// No number box is reached by position, and no single box stands in for the row.
// ============================================================================

function card(page: import('@playwright/test').Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function countBoxes(page: import('@playwright/test').Page, exerciseId: number) {
  return page.locator(`[data-id^="set-count-input-${exerciseId}-"]`)
}

function countBox(page: import('@playwright/test').Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-count-input-${exerciseId}-${index}"]`)
}

function weightBox(page: import('@playwright/test').Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-weight-input-${exerciseId}-${index}"]`)
}

function repsBox(page: import('@playwright/test').Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-reps-input-${exerciseId}-${index}"]`)
}

/**
 * The row that owns one line's boxes. Its identity is the whole named triple —
 * count AND weight AND reps as siblings under one row div — so the count input
 * is no longer the anchor for the row, and reordering or adding a field inside
 * the row cannot silently make this point at a different line.
 */
function setRow(page: import('@playwright/test').Page, exerciseId: number, index: number) {
  const owns = (field: 'count' | 'weight' | 'reps') =>
    `:has(> div > [data-id="set-${field}-input-${exerciseId}-${index}"])`
  return card(page, exerciseId).locator(`div${owns('count')}${owns('weight')}${owns('reps')}`)
}

function cardError(page: import('@playwright/test').Page, exerciseId: number) {
  return card(page, exerciseId).locator('p.text-error')
}

async function openTodayPage(page: import('@playwright/test').Page, exerciseId: number) {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/today')
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible()
  await expect(card(page, exerciseId)).toBeVisible()
}

// ============================================================================
// Shared setup
// ============================================================================

test.beforeEach(() => {
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
})

test.afterEach(() => {
  db.exec('DELETE FROM workout_logs WHERE user_id = 1')
  db.exec('DELETE FROM user_routines WHERE user_id = 1')
  db.exec('DELETE FROM exercises WHERE user_id = 1')
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'exercises'")
})

// ============================================================================
// The flow, proved wired
// ============================================================================

test('a scheduled set line renders an editable SET box beside LB and REPS', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Bench Press')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, exerciseId)

  const box = countBox(page, exerciseId, 0)
  await expect(box).toBeVisible()
  await expect(box).toHaveAttribute('type', 'number')
  await expect(box).toHaveAttribute('min', '1')
  await expect(box).toHaveAttribute('aria-label', 'Set count for set 1')
  await expect(box).toBeEditable()

  // The count the projection carried is what the box holds — not a positional number
  await expect(box).toHaveValue('2')

  // LB and REPS are the count box's row-mates, each named by its own data-id
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(weightBox(page, exerciseId, 0)).toHaveAttribute('aria-label', 'Weight in pounds for set 1')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
  await expect(repsBox(page, exerciseId, 0)).toHaveAttribute('aria-label', 'Reps for set 1')
  await expect(setRow(page, exerciseId, 0).locator('input[type="number"]')).toHaveCount(3)
})

test('a typed count of 3 survives save and reload as one line at that weight and reps', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Squat')

  await openTodayPage(page, exerciseId)

  await weightBox(page, exerciseId, 0).fill('135')
  await repsBox(page, exerciseId, 0).fill('5')
  await countBox(page, exerciseId, 0).fill('3')

  // component -> server action -> JSON column: one line, count 3
  await expectStoredSets(exerciseId, [{ count: 3, weight: 135, reps: 5 }])

  // JSON column -> projection -> rendered line: still one line, still 3
  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
})

test('a blanked count box stores and redisplays 1', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Deadlift')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 5, weight: 225, reps: 3 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')

  await countBox(page, exerciseId, 0).fill('')
  // EMPTY-MEANS-ONE (src/app/today/page.tsx): the box stays blank while the store holds 1
  await expect(countBox(page, exerciseId, 0)).toHaveValue('')

  await expectStoredSets(exerciseId, [{ count: 1, weight: 225, reps: 3 }])

  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('1')
})

test('a count box of 0 stores and redisplays 1', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Overhead Press')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 4, weight: 95, reps: 8 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('4')

  await countBox(page, exerciseId, 0).fill('0')

  await expectStoredSets(exerciseId, [{ count: 1, weight: 95, reps: 8 }])

  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(countBox(page, exerciseId, 0)).toHaveValue('1')
})

test('adding then deleting a line leaves the surviving lines their own counts', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Barbell Row')
  seedTodayLog(exerciseId, [
    { id: 'seed-1', count: 2, weight: 100, reps: 5 },
    { id: 'seed-2', count: 4, weight: 200, reps: 3 },
  ])

  await openTodayPage(page, exerciseId)
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('4')

  // ADD A SET produces a line already counting one set
  await card(page, exerciseId).getByRole('button', { name: 'ADD A SET' }).click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(3)
  await expect(countBox(page, exerciseId, 2)).toHaveValue('1')

  await weightBox(page, exerciseId, 2).fill('60')
  await repsBox(page, exerciseId, 2).fill('10')
  await expectStoredSets(exerciseId, [
    { count: 2, weight: 100, reps: 5 },
    { count: 4, weight: 200, reps: 3 },
    { count: 1, weight: 60, reps: 10 },
  ])

  // Delete the added line — the survivors keep their own counts
  await setRow(page, exerciseId, 2).getByRole('button').click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('4')

  await expectStoredSets(exerciseId, [
    { count: 2, weight: 100, reps: 5 },
    { count: 4, weight: 200, reps: 3 },
  ])

  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('4')
})

test('a pre-count log renders one set per line without the store being rewritten', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Pull-Up')
  seedTodayLog(exerciseId, [
    { id: 'legacy-1', reps: 5, weight: 100 },
    { id: 'legacy-2', reps: 8, weight: 60 },
  ])

  await openTodayPage(page, exerciseId)

  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('1')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('1')

  // The one-set reading comes from the reader, not from a rewrite of the row
  const raw = readRawSets(exerciseId)
  expect(raw).toHaveLength(2)
  expect(raw?.[0]).not.toHaveProperty('count')
  expect(raw?.[1]).not.toHaveProperty('count')
})

// ============================================================================
// Errors and failure surfaces
// ============================================================================

test('a negative count is refused on the card and the typed value stays in the box', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Front Squat')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 1, weight: 185, reps: 5 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('1')

  await countBox(page, exerciseId, 0).fill('-1')

  await expect(cardError(page, exerciseId)).toHaveText('Set count must be at least 1')
  await expect(countBox(page, exerciseId, 0)).toHaveValue('-1')

  // Nothing below 1 ever reached the store
  expect(readStoredSets(exerciseId)).toEqual([{ count: 1, weight: 185, reps: 5 }])
})

/**
 * The rejection half, driven with junk the box's own guards do not stop.
 *
 * `-0.5` is a valid HTML floating-point number, so Chromium hands it through
 * untouched — unlike `1e999`, `0x10` or `abc`, which the number input blanks or
 * mangles before the page sees them, and unlike anything non-numeric, which
 * Playwright refuses to type into `input[type=number]` at all. It also clears
 * the box's own `min="1" step="1"`, which are advisory attributes, not a guard.
 *
 * It is chosen because it is the value that separates "told" from "silently
 * corrected": the floor alone — `Math.max(1, Math.floor(-0.5))` — yields a tidy
 * 1 and the commander is never told their entry was thrown away. Only the
 * refusal in `normalizeSetCount` makes this visible.
 *
 * The seeded count is 3, so the three candidate outcomes are all distinct bytes:
 * the seed (3), the silent floor (1) and the junk (-0.5). The moment the floor
 * rule comes out of src/features/workout/workout-entity.ts the card stops
 * reporting the refusal and the column stops holding the seed, and both
 * assertions below go red.
 */
test('junk the browser hands straight through is refused aloud on the card and never stored', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Romanian Deadlift')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 3, weight: 175, reps: 6 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')

  await countBox(page, exerciseId, 0).fill('-0.5')

  // Chromium delivered it — a swallowed entry would have left the box blank
  await expect(countBox(page, exerciseId, 0)).toHaveValue('-0.5')

  // The commander is told, not silently corrected
  await expect(cardError(page, exerciseId)).toHaveText('Set count must be at least 1')

  // Read only after the round trip has settled: the refusal above proves the
  // save was attempted and came back, so this is not a pre-save snapshot.
  expect(readStoredSets(exerciseId)).toEqual([{ count: 3, weight: 175, reps: 6 }])
})

/**
 * The same junk at the feature's other entry point.
 *
 * `logWorkoutAction` is a `'use server'` boundary, so `sets` is whatever a client
 * posts — the number box's filtering is not a defence. Nothing is seeded here:
 * with the floor rule removed these writes succeed and create a row, so the
 * `null` assertions below go red, and the accepted write pins the byte that
 * actually lands in the `sets` column (2, not 2.7).
 */
test('junk posted to the feature entry point is refused and never reaches the sets column', async () => {
  const exerciseId = seedExerciseOnToday('Landmine Press')
  const date = getTodayISO()

  const nonNumeric = await logWorkoutAction(1, exerciseId, date, [
    { id: 'junk-abc', weight: 175, reps: 6, count: 'abc' as unknown as number },
  ])
  expect(nonNumeric.success).toBe(false)
  // The exact string the card renders (src/app/today/page.tsx -> res.error)
  expect(nonNumeric.error).toBe('Set count must be at least 1')
  expect(readStoredSets(exerciseId)).toBeNull()

  const negative = await logWorkoutAction(1, exerciseId, date, [
    { id: 'junk-neg', weight: 175, reps: 6, count: -1 },
  ])
  expect(negative.success).toBe(false)
  expect(negative.error).toBe('Set count must be at least 1')
  expect(readStoredSets(exerciseId)).toBeNull()

  // A legal-but-fractional count is the one junk value that is accepted — floored
  const fractional = await logWorkoutAction(1, exerciseId, date, [
    { id: 'junk-frac', weight: 175, reps: 6, count: 2.7 },
  ])
  expect(fractional.success).toBe(true)
  await expectStoredSets(exerciseId, [{ count: 2, weight: 175, reps: 6 }])
})

test('a failing save surfaces on that exercise card without reverting the typed count', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Power Clean')

  await openTodayPage(page, exerciseId)

  await countBox(page, exerciseId, 0).fill('3')
  await weightBox(page, exerciseId, 0).fill('135')
  await repsBox(page, exerciseId, 0).fill('0')

  await expect(cardError(page, exerciseId)).toHaveText('Reps must be at least 1')
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')

  // The rejected write never landed
  expect(readStoredSets(exerciseId)).toBeNull()
})
