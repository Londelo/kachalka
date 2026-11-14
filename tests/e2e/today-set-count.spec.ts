import Database from 'better-sqlite3'
import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'

// ============================================================================
// Feature: Typed Set Count — Today's Battle
//
// Proves the count travels the whole wire: the SET box on the exercise card,
// through logWorkoutAction, into the JSON sets column, back out through
// getTodayWorkoutsAction, and onto the rendered line again — plus every error
// and success this feature encapsulates surfacing on the commander's card.
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
// ============================================================================

type StoredLine = { count: number | null; weight: number; reps: number }

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** The app's own day index (Mon=0..Sun=6) for today — same conversion the page uses. */
function todayDayIndex(): number {
  return (new Date().getDay() - 1 + 7) % 7
}

function readRawSets(exerciseId: number): Record<string, unknown>[] | null {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = 1 AND exercise_id = ? AND date = ?')
    .get(exerciseId, todayISO()) as { sets: string } | undefined
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
    todayDayIndex(),
  )
  return exerciseId
}

function seedTodayLog(exerciseId: number, lines: Record<string, unknown>[]): void {
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (1, ?, ?, ?)',
  ).run(exerciseId, todayISO(), JSON.stringify(lines))
}

async function expectStoredSets(exerciseId: number, expected: StoredLine[]): Promise<void> {
  await expect
    .poll(() => readStoredSets(exerciseId), { timeout: 30000, message: `stored lines for exercise ${exerciseId}` })
    .toEqual(expected)
}

// ============================================================================
// Locators — the card is the seam, the count box is the entry point
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

/** The row the count box lives in — reached through the count box's own data-id. */
function setRow(page: import('@playwright/test').Page, exerciseId: number, index: number) {
  return countBox(page, exerciseId, index).locator('xpath=../..')
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

  // LB and REPS sit in the same row, after the count box
  const inputs = setRow(page, exerciseId, 0).locator('input[type="number"]')
  await expect(inputs).toHaveCount(3)
  await expect(inputs.nth(1)).toHaveValue('135')
  await expect(inputs.nth(2)).toHaveValue('5')
})

test('a typed count of 3 survives save and reload as one line at that weight and reps', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Squat')

  await openTodayPage(page, exerciseId)

  const row = setRow(page, exerciseId, 0)
  await row.locator('input[type="number"]').nth(1).fill('135')
  await row.locator('input[type="number"]').nth(2).fill('5')
  await countBox(page, exerciseId, 0).fill('3')

  // component -> server action -> JSON column: one line, count 3
  await expectStoredSets(exerciseId, [{ count: 3, weight: 135, reps: 5 }])

  // JSON column -> projection -> rendered line: still one line, still 3
  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')
  const reloadedRow = setRow(page, exerciseId, 0)
  await expect(reloadedRow.locator('input[type="number"]').nth(1)).toHaveValue('135')
  await expect(reloadedRow.locator('input[type="number"]').nth(2)).toHaveValue('5')
})

test('a blanked count box stores and redisplays 1', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Deadlift')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 5, weight: 225, reps: 3 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')

  await countBox(page, exerciseId, 0).fill('')
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

  const addedRow = setRow(page, exerciseId, 2)
  await addedRow.locator('input[type="number"]').nth(1).fill('60')
  await addedRow.locator('input[type="number"]').nth(2).fill('10')
  await expectStoredSets(exerciseId, [
    { count: 2, weight: 100, reps: 5 },
    { count: 4, weight: 200, reps: 3 },
    { count: 1, weight: 60, reps: 10 },
  ])

  // Delete the added line — the survivors keep their own counts
  await addedRow.getByRole('button').click()
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

test('garbage typed into the count box never stores a line below 1', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Romanian Deadlift')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 3, weight: 175, reps: 6 }])

  await openTodayPage(page, exerciseId)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')

  await countBox(page, exerciseId, 0).pressSequentially('abc')

  const typed = await countBox(page, exerciseId, 0).inputValue()
  expect(typed).not.toContain('NaN')
  expect(typed).not.toMatch(/[a-c]/i)

  // Whatever the box settled on, the next save still cannot store below 1
  await setRow(page, exerciseId, 0).locator('input[type="number"]').nth(2).fill('7')
  await expect
    .poll(() => readStoredSets(exerciseId), { timeout: 30000 })
    .toEqual([{ count: 3, weight: 175, reps: 7 }])

  const stored = readStoredSets(exerciseId)
  expect(stored?.every((line) => typeof line.count === 'number' && line.count >= 1)).toBe(true)
})

test('a failing save surfaces on that exercise card without reverting the typed count', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Power Clean')

  await openTodayPage(page, exerciseId)

  const row = setRow(page, exerciseId, 0)
  await countBox(page, exerciseId, 0).fill('3')
  await row.locator('input[type="number"]').nth(1).fill('135')
  await row.locator('input[type="number"]').nth(2).fill('0')

  await expect(cardError(page, exerciseId)).toHaveText('Reps must be at least 1')
  await expect(countBox(page, exerciseId, 0)).toHaveValue('3')

  // The rejected write never landed
  expect(readStoredSets(exerciseId)).toBeNull()
})
