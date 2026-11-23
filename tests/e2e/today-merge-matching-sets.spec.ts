import Database from 'better-sqlite3'
import { test, expect } from '@playwright/test'
import { getTodayISO, jsDayToAppIndex } from '@/shared/utils/date'
import { logWorkoutAction } from '@/features/workout/workout-server-actions'

// ============================================================================
// Feature: Merge Matching Sets — Today's Battle
//
// The micro tier already proved each piece alone: `collapseDuplicateSets` over
// its whole input matrix (tests/unit/features/workout/workout-entity.spec.ts)
// and `logWorkoutUseCase` folding and rejecting before the repository
// (tests/unit/features/workout/log-workout.spec.ts). Neither can see whether
// the rule is actually wired into the card the commander types into.
//
// This suite proves the composition, from outside:
//   the SET/LB/REPS boxes -> TodayPage.handleSetChange -> collapseDuplicateSets
//   -> the rendered rows, and -> debouncedSave -> logWorkoutAction -> the
//   `sets` column -> getTodayWorkoutsAction -> the rows again after a reload.
//
// Deliberately NOT here (owned elsewhere, listed in the ticket):
//   * the collapse helper's input matrix and position irrelevance as a pure
//     function — micro tier;
//   * the SET box's own floor, its blank-means-one rule and its junk refusal —
//     feature Typed Set Count, tests/e2e/today-set-count.spec.ts;
//   * War Logs, Force Progression and the PAST SESSION toggle — epic tier.
// ============================================================================

// The project's e2e port is the default; the override exists so this suite can
// be verified while another worktree's dev server already holds 3111.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3111'

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

const existingTables = (
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workout_logs','user_routines','exercises','users')",
    )
    .all() as { name: string }[]
).map((row) => row.name)

if (existingTables.length > 0) {
  db.exec('DELETE FROM workout_logs')
  db.exec('DELETE FROM user_routines')
  db.exec('DELETE FROM exercises')
  db.exec('DELETE FROM users')
  db.exec('DELETE FROM sqlite_sequence')
}

// ============================================================================
// Seams
//
// The date and the day index come from the same functions the page calls
// (src/shared/utils/date.ts), so this spec seeds and asserts under the date the
// app writes.
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
    .poll(() => readStoredSets(exerciseId), {
      timeout: 30000,
      message: `stored lines for exercise ${exerciseId}`,
    })
    .toEqual(expected)
}

// ============================================================================
// Locators — the selector contract in src/app/today/page.tsx
//
// Every box by its own data-id, the row by the whole named triple. No box is
// reached by position alone, so a fold that moves a line cannot make an
// assertion silently point at a different line.
// ============================================================================

type Page = import('@playwright/test').Page

function card(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function countBoxes(page: Page, exerciseId: number) {
  return page.locator(`[data-id^="set-count-input-${exerciseId}-"]`)
}

function countBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-count-input-${exerciseId}-${index}"]`)
}

function weightBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-weight-input-${exerciseId}-${index}"]`)
}

function repsBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-reps-input-${exerciseId}-${index}"]`)
}

function setRow(page: Page, exerciseId: number, index: number) {
  const owns = (field: 'count' | 'weight' | 'reps') =>
    `:has(> div > [data-id="set-${field}-input-${exerciseId}-${index}"])`
  return card(page, exerciseId).locator(`div${owns('count')}${owns('weight')}${owns('reps')}`)
}

function cardError(page: Page, exerciseId: number) {
  return card(page, exerciseId).locator('p.text-error')
}

async function openTodayPage(page: Page, ...exerciseIds: number[]) {
  await page.context().addCookies([
    { name: 'kachalka.userId', value: '1', url: BASE_URL },
  ])
  await page.goto(`${BASE_URL}/today`)
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible()
  for (const exerciseId of exerciseIds) {
    await expect(card(page, exerciseId)).toBeVisible()
  }
}

function addASet(page: Page, exerciseId: number) {
  return card(page, exerciseId).getByRole('button', { name: 'ADD A SET' })
}

/**
 * A line is typed weight first, then count, then reps last.
 *
 * Reps is the field that completes the match key, so it is the keystroke that
 * must fuse the line — typing it earlier would fold the row before its count was
 * in, and the row under the assertion would be a different row.
 */
async function typeLine(
  page: Page,
  exerciseId: number,
  index: number,
  line: { weight: string; reps: string; count: string },
): Promise<void> {
  await weightBox(page, exerciseId, index).fill(line.weight)
  await countBox(page, exerciseId, index).fill(line.count)
  await repsBox(page, exerciseId, index).fill(line.reps)
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

test('typing a second line at the first line’s weight and reps fuses them into one line carrying the sum', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Bench Press')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, exerciseId)
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')

  await addASet(page, exerciseId).click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)

  await typeLine(page, exerciseId, 1, { weight: '135', reps: '5', count: '3' })

  // handleSetChange ran the domain rule before anything was saved: one row on
  // screen, its count the sum of the two lines that were typed.
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')

  // ...and the sum is what crossed the wire and landed in the sets column.
  await expectStoredSets(exerciseId, [{ count: 5, weight: 135, reps: 5 }])
})

test('whichever of two matching lines is typed first, the card and the column hold the same single line', async ({
  page,
}) => {
  const twoThenThree = seedExerciseOnToday('Incline Press')
  const threeThenTwo = seedExerciseOnToday('Close Grip Bench')

  await openTodayPage(page, twoThenThree, threeThenTwo)

  for (const [exerciseId, firstCount, secondCount] of [
    [twoThenThree, '2', '3'],
    [threeThenTwo, '3', '2'],
  ] as const) {
    await typeLine(page, exerciseId, 0, { weight: '135', reps: '5', count: firstCount })
    await addASet(page, exerciseId).click()
    await expect(countBoxes(page, exerciseId)).toHaveCount(2)
    await typeLine(page, exerciseId, 1, { weight: '135', reps: '5', count: secondCount })

    await expect(countBoxes(page, exerciseId)).toHaveCount(1)
    await expect(countBox(page, exerciseId, 0)).toHaveValue('5')
  }

  // Position is not meaningful to the rule, and the component's slot
  // reassembly must not smuggle it back in: both orders end on one identical line.
  await expectStoredSets(twoThenThree, [{ count: 5, weight: 135, reps: 5 }])
  await expectStoredSets(threeThenTwo, [{ count: 5, weight: 135, reps: 5 }])
})

test('a third matching line adds its own count to the line already on screen', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Squat')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, exerciseId)

  await addASet(page, exerciseId).click()
  await typeLine(page, exerciseId, 1, { weight: '135', reps: '5', count: '3' })
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')

  await addASet(page, exerciseId).click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await typeLine(page, exerciseId, 1, { weight: '135', reps: '5', count: '4' })

  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('9')

  await expectStoredSets(exerciseId, [{ count: 9, weight: 135, reps: 5 }])
})

test('a line differing in weight alone, and one differing in reps alone, stay separate lines with their own counts', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Deadlift')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, exerciseId)

  await addASet(page, exerciseId).click()
  await typeLine(page, exerciseId, 1, { weight: '145', reps: '5', count: '2' })
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)

  await addASet(page, exerciseId).click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(3)
  await typeLine(page, exerciseId, 2, { weight: '135', reps: '8', count: '3' })

  // The match key is weight AND reps — neither near-miss folded.
  await expect(countBoxes(page, exerciseId)).toHaveCount(3)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('2')
  await expect(weightBox(page, exerciseId, 1)).toHaveValue('145')
  await expect(repsBox(page, exerciseId, 1)).toHaveValue('5')
  await expect(countBox(page, exerciseId, 2)).toHaveValue('3')
  await expect(weightBox(page, exerciseId, 2)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 2)).toHaveValue('8')

  await expectStoredSets(exerciseId, [
    { count: 2, weight: 135, reps: 5 },
    { count: 2, weight: 145, reps: 5 },
    { count: 3, weight: 135, reps: 8 },
  ])
})

test('deleting one of two matching lines leaves the survivor its own count, not a re-derived one', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Barbell Row')
  seedTodayLog(exerciseId, [
    { id: 'seed-1', count: 3, weight: 135, reps: 5 },
    { id: 'seed-2', count: 2, weight: 135, reps: 5 },
    { id: 'seed-3', count: 4, weight: 200, reps: 3 },
  ])

  await openTodayPage(page, exerciseId)
  await expect(countBoxes(page, exerciseId)).toHaveCount(3)

  await setRow(page, exerciseId, 0).getByRole('button').click()

  // handleRemoveSet filters by index and nothing else: the survivor at 135x5 is
  // still 2 — neither the deleted line's 3 nor a re-fold's 5 nor a fresh 1.
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('4')
  await expect(weightBox(page, exerciseId, 1)).toHaveValue('200')
  await expect(repsBox(page, exerciseId, 1)).toHaveValue('3')

  // And the deleted line's count migrated onto nobody in the column either.
  await expectStoredSets(exerciseId, [
    { count: 2, weight: 135, reps: 5 },
    { count: 4, weight: 200, reps: 3 },
  ])
})

test('a reload brings the collapsed line back from storage, not the lines that were typed', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Overhead Press')
  seedTodayLog(exerciseId, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, exerciseId)

  await addASet(page, exerciseId).click()
  await typeLine(page, exerciseId, 1, { weight: '135', reps: '5', count: '3' })
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expectStoredSets(exerciseId, [{ count: 5, weight: 135, reps: 5 }])

  await page.reload()
  await expect(card(page, exerciseId)).toBeVisible()

  // The collapsed state is what the read path returned: one line, five sets.
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('135')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
})

test('the browser and the feature entry point collapse the same three lines to the same stored bytes', async ({
  page,
}) => {
  const viaBrowser = seedExerciseOnToday('Push Press')
  const viaEntry = seedExerciseOnToday('Zottman Curl')
  seedTodayLog(viaBrowser, [{ id: 'seed-1', count: 2, weight: 135, reps: 5 }])

  await openTodayPage(page, viaBrowser)

  await addASet(page, viaBrowser).click()
  await typeLine(page, viaBrowser, 1, { weight: '135', reps: '5', count: '3' })
  await addASet(page, viaBrowser).click()
  await expect(countBoxes(page, viaBrowser)).toHaveCount(2)
  await typeLine(page, viaBrowser, 1, { weight: '135', reps: '5', count: '4' })
  await expect(countBoxes(page, viaBrowser)).toHaveCount(1)
  await expectStoredSets(viaBrowser, [{ count: 9, weight: 135, reps: 5 }])

  // The same three logical lines, posted un-collapsed straight at the
  // 'use server' boundary. A second grouping implementation anywhere in this
  // feature diverges from the browser's output and this assertion goes red.
  const res = await logWorkoutAction(1, viaEntry, getTodayISO(), [
    { id: 'post-1', weight: 135, reps: 5, count: 2 },
    { id: 'post-2', weight: 135, reps: 5, count: 3 },
    { id: 'post-3', weight: 135, reps: 5, count: 4 },
  ])
  expect(res.success).toBe(true)
  await expectStoredSets(viaEntry, [{ count: 9, weight: 135, reps: 5 }])

  expect(readStoredSets(viaBrowser)).toEqual(readStoredSets(viaEntry))
})

// ============================================================================
// Errors and failure surfaces
// ============================================================================

test('a fused line the server refuses is reported on that card without the two lines coming back', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Power Clean')

  await openTodayPage(page, exerciseId)

  // Two lines at 135 lb and 0 reps — weight alone keeps them out of the blank
  // filter, so they reach the fold and then the save.
  await typeLine(page, exerciseId, 0, { weight: '135', reps: '0', count: '2' })
  await addASet(page, exerciseId).click()
  await typeLine(page, exerciseId, 1, { weight: '135', reps: '0', count: '3' })

  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')

  // The fold did not hide the invalid line: the server's refusal reaches the card.
  await expect(cardError(page, exerciseId)).toHaveText('Reps must be at least 1')

  // ...and the refusal did not silently revert the fusion.
  await expect(countBoxes(page, exerciseId)).toHaveCount(1)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('5')

  expect(readStoredSets(exerciseId)).toBeNull()
})

test('two blank lines neither fold into one nor put a line in the store', async ({ page }) => {
  const exerciseId = seedExerciseOnToday('Front Squat')
  seedTodayLog(exerciseId, [
    { id: 'seed-1', count: 2, weight: 135, reps: 5 },
    { id: 'seed-2', count: 3, weight: 200, reps: 3 },
  ])

  await openTodayPage(page, exerciseId)
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)

  // Clear both boxes of both rows: each row is now weight 0 and reps 0, the
  // exact predicate the fold and the save both treat as an untouched row.
  await weightBox(page, exerciseId, 0).fill('')
  await repsBox(page, exerciseId, 0).fill('')
  await weightBox(page, exerciseId, 1).fill('')
  await repsBox(page, exerciseId, 1).fill('')

  // Two untouched rows must not fold into one, and neither may move slot.
  await expect(countBoxes(page, exerciseId)).toHaveCount(2)
  await expect(countBox(page, exerciseId, 0)).toHaveValue('2')
  await expect(countBox(page, exerciseId, 1)).toHaveValue('3')

  // A blank line contributes nothing to what is stored. The third line below is
  // the save that proves it: it fires the write path for this exercise and the
  // column comes back holding that line and nothing else — no 0 lb / 0 rep line
  // was ever added for the two rows the commander emptied.
  await addASet(page, exerciseId).click()
  await expect(countBoxes(page, exerciseId)).toHaveCount(3)
  await typeLine(page, exerciseId, 2, { weight: '95', reps: '10', count: '1' })

  await expectStoredSets(exerciseId, [{ count: 1, weight: 95, reps: 10 }])
})
