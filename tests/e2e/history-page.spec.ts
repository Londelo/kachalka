import Database from 'better-sqlite3'
import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

// Clean slate before any test runs
db.exec("DELETE FROM workout_logs")
db.exec("DELETE FROM user_routines")
db.exec("DELETE FROM exercises")
db.exec("DELETE FROM users")
db.exec("DELETE FROM sqlite_sequence")

function createExercises(names: string[]): number[] {
  const stmt = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
  const ids: number[] = []
  for (const name of names) {
    const result = stmt.run(name, 1)
    ids.push(Number(result.lastInsertRowid))
  }
  return ids
}

function assignExercise(exerciseId: number, dayOfWeek: number): void {
  db.prepare(
    'INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)',
  ).run(1, exerciseId, dayOfWeek)
}

function createWorkoutLog(exerciseId: number, date: string, sets: { reps: number; weight: number }[]): void {
  const stmt = db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
  )
  stmt.run(1, exerciseId, date, JSON.stringify(sets))
}

function cleanupBruno(): void {
  db.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(1)
  db.prepare('DELETE FROM user_routines WHERE user_id = ?').run(1)
  db.prepare('DELETE FROM exercises WHERE user_id = ?').run(1)
  db.prepare('DELETE FROM users WHERE id = ?').run(1)
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')")
}

test.beforeEach(async ({ page }) => {
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
})

test.afterEach(() => {
  cleanupBruno()
})

// ──────────────────────────────────────────────
// Basic page rendering
// ──────────────────────────────────────────────

test('renders header and subtitle for authenticated user', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('CAMPAIGN HISTORY & PERFORMANCE DATA')).toBeVisible({ timeout: 10000 })
})

test('redirects to home when no user cookie', async ({ page }) => {
  await page.goto('http://localhost:3111/history')
  // Without a user cookie, the page client redirects to /
  // The history page should never render
  await expect(page.locator('#history-page')).not.toBeVisible({ timeout: 5000 })
})

// ──────────────────────────────────────────────
// History list with seed data
// ──────────────────────────────────────────────

test('history list displays when workout data exists', async ({ page }) => {
  // Create data
  const [exerciseId] = createExercises(['Barbell Curl'])
  assignExercise(exerciseId, 0) // Monday
  createWorkoutLog(exerciseId, '2026-06-15', [
    { reps: 10, weight: 100 },
    { reps: 10, weight: 125 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Session card should be visible
  await expect(page.locator('#history-date-2026-06-15')).toBeVisible()
})

test('multiple sessions display newest first', async ({ page }) => {
  const [exerciseId] = createExercises(['Squat'])
  assignExercise(exerciseId, 2) // Wednesday
  createWorkoutLog(exerciseId, '2026-05-20', [{ reps: 5, weight: 200 }])
  createWorkoutLog(exerciseId, '2026-06-03', [{ reps: 5, weight: 225 }])
  createWorkoutLog(exerciseId, '2026-06-17', [{ reps: 5, weight: 250 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // All three session cards should exist
  await expect(page.locator('#history-date-2026-05-20')).toBeVisible()
  await expect(page.locator('#history-date-2026-06-03')).toBeVisible()
  await expect(page.locator('#history-date-2026-06-17')).toBeVisible()

  // Verify order: newest first (DOM order)
  const dates = await page.locator('[id^="history-date-"]').all()
  const dateIds = await Promise.all(dates.map((d) => d.getAttribute('id')))
  const extracted = dateIds.map((id) => id?.replace('history-date-', '')).filter(Boolean) as string[]
  // Should be sorted descending
  for (let i = 1; i < extracted.length; i++) {
    expect(extracted[i - 1]! > extracted[i]!).toBe(true)
  }
})

test('exercise rows display correct name, set count, and max weight', async ({ page }) => {
  const [pullUpId, curlId, deadliftId] = createExercises(['Pull-Up', 'Barbell Curl', 'Deadlift'])
  assignExercise(pullUpId, 4) // Friday
  assignExercise(curlId, 0) // Monday
  assignExercise(deadliftId, 2) // Wednesday

  createWorkoutLog(pullUpId, '2026-06-19', [
    { reps: 8, weight: 50 },
    { reps: 8, weight: 55 },
    { reps: 8, weight: 60 },
  ])
  createWorkoutLog(curlId, '2026-06-22', [
    { reps: 10, weight: 45 },
    { reps: 10, weight: 50 },
    { reps: 10, weight: 55 },
  ])
  createWorkoutLog(deadliftId, '2026-06-10', [
    { reps: 5, weight: 135 },
    { reps: 5, weight: 185 },
    { reps: 3, weight: 225 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Exercise names
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Pull-Up' })).toContainText('Pull-Up')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Barbell Curl' })).toContainText('Barbell Curl')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Deadlift' })).toContainText('Deadlift')

  // Set counts
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Pull-Up' })).toContainText('3')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Barbell Curl' })).toContainText('3')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Deadlift' })).toContainText('3')

  // Max weights
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Pull-Up' })).toContainText('60')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Barbell Curl' })).toContainText('55')
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Deadlift' })).toContainText('225')
})

test('aggregate metrics show correct volume for session', async ({ page }) => {
  const [exerciseId1, exerciseId2] = createExercises(['Bench Press', 'Overhead Press'])
  assignExercise(exerciseId1, 0)
  assignExercise(exerciseId2, 0)

  // Bench Press: 3 sets of 10@100 = 300 volume
  createWorkoutLog(exerciseId1, '2026-06-08', [
    { reps: 10, weight: 100 },
    { reps: 10, weight: 100 },
    { reps: 10, weight: 100 },
  ])
  // Overhead Press: 3 sets of 8@65 = 156 volume
  createWorkoutLog(exerciseId2, '2026-06-08', [
    { reps: 8, weight: 65 },
    { reps: 8, weight: 65 },
    { reps: 8, weight: 65 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  const sessionCard = page.locator('#history-date-2026-06-08')
  // Bench Press: 3 sets * 10 reps * 100 weight = 3000 volume
  // Overhead Press: 3 sets * 8 reps * 65 weight = 1560 volume
  // Total volume = 3000 + 1560 = 4560
  // Total sets = 3 + 3 = 6
  // Total reps = 30 + 24 = 54
  // Target the aggregate metric blocks (dark bg p-3 divs at bottom of session card)
  const metricBlocks = sessionCard.locator('[class*="bg-on-surface"][class*="p-3"]')
  await expect(metricBlocks.nth(0).locator('p').nth(1)).toHaveText('4,560')
  await expect(metricBlocks.nth(1).locator('p').nth(1)).toHaveText('6')
  await expect(metricBlocks.nth(2).locator('p').nth(1)).toHaveText('54')
})

// ──────────────────────────────────────────────
// Set detail modal
// ──────────────────────────────────────────────

test('modal opens, displays exercise name, and shows set details', async ({ page }) => {
  const [squatId, rowId, pullUpId] = createExercises(['Squat', 'Barbell Row', 'Pull-Up'])
  assignExercise(squatId, 4)
  assignExercise(rowId, 2)
  assignExercise(pullUpId, 0)

  createWorkoutLog(squatId, '2026-06-16', [
    { reps: 5, weight: 200 },
    { reps: 5, weight: 225 },
  ])
  createWorkoutLog(rowId, '2026-06-11', [
    { reps: 10, weight: 135 },
    { reps: 8, weight: 145 },
  ])
  createWorkoutLog(pullUpId, '2026-06-01', [
    { reps: 10, weight: 0 },
    { reps: 8, weight: 25 },
    { reps: 6, weight: 45 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Open modal by clicking Pull-Up exercise button
  await page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Pull-Up' }).click()

  // Modal opens and shows exercise name in header
  await expect(page.locator('#history-set-detail-modal')).toBeVisible()
  await expect(page.locator('#history-set-detail-modal')).toContainText('Pull-Up')

  // Modal shows individual set details (set numbers, weights, reps)
  const modal = page.locator('#history-set-detail-modal')
  await expect(modal).toContainText('SET:')
  await expect(modal).toContainText('0')
  await expect(modal).toContainText('25')
  await expect(modal).toContainText('45')
  await expect(modal).toContainText('10')
  await expect(modal).toContainText('8')
  await expect(modal).toContainText('6')
})

test('modal shows exercise summary (volume, sets, max)', async ({ page }) => {
  const [exerciseId] = createExercises(['Deadlift'])
  assignExercise(exerciseId, 4)
  createWorkoutLog(exerciseId, '2026-06-20', [
    { reps: 5, weight: 185 },
    { reps: 5, weight: 225 },
    { reps: 3, weight: 275 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  await page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Deadlift' }).click()

  const modal = page.locator('#history-set-detail-modal')
  // Volume = 5*185 + 5*225 + 3*275 = 925 + 1125 + 825 = 2,875
  const volumeBlock = modal.locator('p').filter({ hasText: 'VOLUME' }).locator('..')
  await expect(volumeBlock.locator('p').nth(1)).toHaveText('2,875')
  // Sets = 3
  const setsBlock = modal.locator('p').filter({ hasText: 'SETS' }).locator('..')
  await expect(setsBlock.locator('p').nth(1)).toHaveText('3')
  // Max LB = 275
  const maxBlock = modal.locator('p').filter({ hasText: 'MAX LB' }).locator('..')
  await expect(maxBlock.locator('p').nth(1)).toHaveText('275')
})

test('modal closes via backdrop click and CLOSE button', async ({ page }) => {
  const [pressId, curlId] = createExercises(['Bench Press', 'Barbell Curl'])
  assignExercise(pressId, 0)
  assignExercise(curlId, 4)

  createWorkoutLog(pressId, '2026-06-09', [{ reps: 5, weight: 185 }])
  createWorkoutLog(curlId, '2026-06-14', [
    { reps: 8, weight: 95 },
    { reps: 8, weight: 100 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Close via backdrop click
  await page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Bench Press' }).click()
  await expect(page.locator('#history-set-detail-modal')).toBeVisible()
  await page.locator('#history-set-detail-modal').click({ position: { x: 0, y: 0 } })
  await expect(page.locator('#history-set-detail-modal')).not.toBeVisible()

  // Close via CLOSE button
  await page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Barbell Curl' }).click()
  await expect(page.locator('#history-set-detail-modal')).toBeVisible()
  const modal = page.locator('#history-set-detail-modal')
  await modal.getByRole('button', { name: 'CLOSE', exact: true }).click()
  await expect(page.locator('#history-set-detail-modal')).not.toBeVisible()
})

test('empty state shows when no history', async ({ page }) => {
  // No workout logs created — only Bruno user exists
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Empty state should be visible
  await expect(page.locator('#history-empty')).toBeVisible()
  await expect(page.getByText('NO WAR RECORDS FOUND')).toBeVisible()
})

// ──────────────────────────────────────────────
// Multiple exercises in same session
// ──────────────────────────────────────────────

test('multiple exercises in same session show as separate rows', async ({ page }) => {
  const [curlId, squatId] = createExercises(['Barbell Curl', 'Squat'])
  assignExercise(curlId, 0)
  assignExercise(squatId, 0)

  createWorkoutLog(curlId, '2026-06-22', [
    { reps: 12, weight: 35 },
    { reps: 12, weight: 40 },
  ])
  createWorkoutLog(squatId, '2026-06-22', [
    { reps: 5, weight: 135 },
    { reps: 5, weight: 155 },
    { reps: 5, weight: 175 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/history')
  await expect(page.getByRole('heading', { name: 'WAR LOGS' })).toBeVisible({ timeout: 10000 })

  // Both exercise buttons should exist
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Barbell Curl' })).toBeVisible()
  await expect(page.locator('[id^="history-exercise-btn-"]').filter({ hasText: 'Squat' })).toBeVisible()

  // Aggregate: volume = 3225, sets = 5, reps = 39
  // toLocaleString() formats 3225 as "3,225"
  const sessionCard = page.locator('#history-date-2026-06-22')
  // Target the aggregate metric blocks (bg-on-surface divs at bottom of session card)
  const metricBlocks = sessionCard.locator('[class*="bg-on-surface"][class*="p-3"]')
  await expect(metricBlocks.nth(0).locator('p').nth(1)).toHaveText('3,225')
  await expect(metricBlocks.nth(1).locator('p').nth(1)).toHaveText('5')
  await expect(metricBlocks.nth(2).locator('p').nth(1)).toHaveText('39')
})
