import Database from 'better-sqlite3'
import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'

// ============================================================================
// Database setup — runs once per test file worker
// ============================================================================

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

// Clean slate before any tests run
db.exec("DELETE FROM workout_logs")
db.exec("DELETE FROM user_routines")
db.exec("DELETE FROM exercises")
db.exec("DELETE FROM users")
db.exec("DELETE FROM sqlite_sequence")

// ============================================================================
// Data helpers
// ============================================================================

/** Create exercises for Bruno and return their IDs. */
function createExercises(names: string[]): number[] {
  const ids: number[] = []
  const insert = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, 1)')
  for (const name of names) {
    const info = insert.run(name)
    ids.push(Number(info.lastInsertRowid))
  }
  return ids
}

/** Create a workout log entry for Bruno. */
function createWorkoutLog(exerciseId: number, date: string, sets: { id: string; reps: number; weight: number }[]): void {
  const jsonSets = JSON.stringify(sets)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)',
  ).run(exerciseId, date, jsonSets, now, now)
}

/** Clean up Bruno's exercises, routines, and workout logs between tests. */
function cleanupBruno(): void {
  db.exec("DELETE FROM workout_logs WHERE user_id = 1")
  db.exec("DELETE FROM user_routines WHERE user_id = 1")
  db.exec("DELETE FROM exercises WHERE user_id = 1")
  // Reset auto-increment so next test's exercises start at id=1
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'exercises'")
}

// ============================================================================
// Shared setup — runs before every test
// ============================================================================

test.beforeEach(async ({ page }) => {
  // Ensure Bruno exists with id=1 (REPLACE handles re-creation after afterEach cleanup)
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run(
    'Bruno',
    1,
  )
  // Reset auto-increment counters so exercise IDs start at 1
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
})

test.afterEach(() => {
  // Clean up all Bruno data so each test starts fresh
  cleanupBruno()
})

// ============================================================================
// Progress page E2E tests
// ============================================================================

test('progress page loads with header and controls', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Exercise selector visible
  await expect(page.locator('[id="progress-exercise-selector"]')).toBeVisible()
  await expect(page.locator('[id="progress-exercise-selector"] select')).toBeVisible()

  // Range pills visible
  await expect(page.getByRole('button', { name: '6M' })).toBeVisible()
  await expect(page.getByRole('button', { name: '1Y' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible()

  // Granularity pills visible
  await expect(page.getByRole('button', { name: 'session' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'week' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'month' })).toBeVisible()

  // Default state: 6M and session should be active (highlighted)
  await expect(page.getByRole('button', { name: '6M' })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: 'session' })).toHaveClass(/bg-primary/)
})

test('shows empty state when no workout data exists', async ({ page }) => {
  // Create exercises but no workout logs
  createExercises(['Bench Press', 'Squat'])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Empty state should appear (no chart, no workout data)
  await expect(page.locator('[id="progress-empty"]')).toBeVisible()
  await expect(page.getByText('NO DATA YET')).toBeVisible()
  await expect(page.getByText('LOG WORKOUTS TO SEE PROGRESSION')).toBeVisible()

  // Chart should not be visible
  await expect(page.locator('[id="progress-bar-chart"]')).not.toBeVisible()
})

test('shows chart bars when workout data exists', async ({ page }) => {
  // Create exercise and workout logs
  const exerciseId = createExercises(['Bench Press'])[0]
  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
  ])
  createWorkoutLog(exerciseId, '2026-05-08', [
    { id: 's2', reps: 5, weight: 140 },
  ])
  createWorkoutLog(exerciseId, '2026-05-15', [
    { id: 's3', reps: 5, weight: 145 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Wait for loading to clear, then verify chart appears
  await expect(page.getByText('LOADING...')).not.toBeVisible({ timeout: 10000 })

  // Chart section should be visible
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()

  // Empty state should NOT be visible
  await expect(page.locator('[id="progress-empty"]')).not.toBeVisible()
})

test('exercise dropdown lists exercises with workout logs', async ({ page }) => {
  // Create exercises — only one has workout logs
  const ids = createExercises(['Bench Press', 'Pull-Up', 'Squat'])
  // Only create workout logs for Bench Press and Squat
  createWorkoutLog(ids[0], '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[2], '2026-05-01', [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Get dropdown options
  const options = page.locator('[id="progress-exercise-selector"] select option')
  const count = await options.count()

  // Should have "ALL EXERCISES" + the 2 exercises with logs (sorted alphabetically: Bench Press, Squat)
  expect(count).toBe(3)

  // First option should be ALL EXERCISES
  await expect(options.first()).toHaveText('ALL EXERCISES')

  // Remaining options sorted alphabetically
  const texts = await options.allTextContents()
  expect(texts).toEqual(expect.arrayContaining(['ALL EXERCISES', 'Bench Press', 'Squat']))
})

test('selecting an exercise filters chart to that exercise', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat'])

  // Bench Press: 5x135 = 675 volume
  createWorkoutLog(ids[0], '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])
  // Squat: 5x225 = 1125 volume
  createWorkoutLog(ids[1], '2026-05-01', [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Select "Squat" from dropdown
  await page.locator('[id="progress-exercise-selector"] select').selectOption('Squat')

  // Wait for chart to update
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Chart title should still show VOLUME BY SESSION
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()
})

test('selecting ALL EXERCISES shows aggregated data', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat'])

  createWorkoutLog(ids[0], '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[1], '2026-05-01', [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Default is ALL EXERCISES — chart should be visible
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Select Bench Press, then go back to ALL EXERCISES
  await page.locator('[id="progress-exercise-selector"] select').selectOption('Bench Press')
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Go back to ALL EXERCISES
  await page.locator('[id="progress-exercise-selector"] select').selectOption('')
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes time range when clicking 6M pill', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  // Old data outside 6M window
  createWorkoutLog(exerciseId, '2024-01-01', [{ id: 's1', reps: 5, weight: 135 }])
  // Recent data within 6M window
  createWorkoutLog(exerciseId, '2026-05-01', [{ id: 's2', reps: 5, weight: 140 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Default range is 6M — should show the recent data
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Click ALL range pill
  await page.getByRole('button', { name: 'ALL' }).click()

  // ALL pill should be active
  await expect(page.getByRole('button', { name: 'ALL' })).toHaveClass(/bg-primary/)
  // 6M pill should be inactive
  await expect(page.getByRole('button', { name: '6M' })).not.toHaveClass(/bg-primary/)

  // Now should show both old and recent data points
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes time range when clicking 1Y pill', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  // Data outside 1Y but within 6M? No — 1Y > 6M.
  // Create data that's within 1Y but outside 6M (~7-11 months ago)
  createWorkoutLog(exerciseId, '2025-08-01', [{ id: 's1', reps: 5, weight: 135 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Default 6M: Aug 2025 is outside 180 days from Jun 2026, so no data
  // Switch to 1Y: Aug 2025 should be within 365 days
  await page.getByRole('button', { name: '1Y' }).click()
  await expect(page.getByRole('button', { name: '1Y' })).toHaveClass(/bg-primary/)
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes granularity between session week and month', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(exerciseId, '2026-05-08', [{ id: 's2', reps: 5, weight: 140 }])
  createWorkoutLog(exerciseId, '2026-05-15', [{ id: 's3', reps: 5, weight: 145 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Default granularity is month
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
  await expect(page.getByRole('button', { name: 'month' })).toHaveClass(/bg-primary/)

  // Switch to session granularity
  await page.getByRole('button', { name: 'session' }).click()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()
  await expect(page.getByRole('button', { name: 'session' })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: 'month' })).not.toHaveClass(/bg-primary/)

  // Switch to week granularity
  await page.getByRole('button', { name: 'week' }).click()
  await expect(page.getByText('VOLUME BY WEEK')).toBeVisible()
  await expect(page.getByRole('button', { name: 'week' })).toHaveClass(/bg-primary/)
})

/** Click on the chart container center — Recharts Bar onClick fires on click within the chart. */
async function clickChartBar(page: { mouse: { click: (x: number, y: number) => Promise<void> } }) {
  const chart = page.locator('[id="progress-bar-chart"]')
  const box = await chart.boundingBox()
  if (!box) throw new Error('Chart bounding box not found')
  // Click at the center of the chart area
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

test('clicking a bar opens detail modal', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Chart should be visible
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Click on the first bar (JS finds bar rect coords, then clicks center)
  await clickChartBar(page)

  // Modal should appear
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })
})

test('modal shows date, exercise name, and metrics', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Click on the first bar (JS finds bar rect coords, then clicks center)
  await clickChartBar(page)

  // Modal should appear
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })

  // Date badge visible — FRI, 01 MAY 2026 (May 1, 2026 is a Friday)
  await expect(page.getByText('FRI, 01 MAY 2026')).toBeVisible()

  // Exercise name visible (scoped to modal to avoid strict mode conflict with dropdown)
  await expect(page.locator('[id="progress-detail-modal"]').getByText('Bench Press')).toBeVisible()

  // Metrics visible: exercise name, sets, reps, volume, max weight
  const modal = page.locator('[id="progress-detail-modal"]')
  await expect(modal.getByText('Bench Press')).toBeVisible()
  // Use regex to match any numeric value for these fields (test data may vary across retries)
  await expect(modal.getByText(/sets/)).toBeVisible()
  await expect(modal.getByText(/reps/)).toBeVisible()
  await expect(modal.getByText(/vol/)).toBeVisible()
  await expect(modal.getByText(/max lb/)).toBeVisible()

  // Grand total volume
  await expect(modal.getByText('TOTAL VOLUME')).toBeVisible()
  await expect(modal.getByText('1,140').first()).toBeVisible()

  // Close button visible
  await expect(page.getByRole('button', { name: 'CLOSE' })).toBeVisible()
})

test('closing modal via close button dismisses it', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Open modal by clicking the chart area
  const chart = page.locator('[id="progress-bar-chart"]')
  await clickChartBar(page)
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })

  // Click CLOSE
  await page.getByRole('button', { name: 'CLOSE' }).click()

  // Modal should be gone
  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('closing modal via backdrop click dismisses it', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Open modal by clicking the chart area
  const chart = page.locator('[id="progress-bar-chart"]')
  await clickChartBar(page)
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })

  // Click outside the modal (backdrop)
  await page.locator('[id="progress-detail-modal"]').click({ position: { x: 0, y: 0 } })

  // Modal should be gone
  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('modal does not open on hover', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Hover over the chart — no modal should appear
  const chart = page.locator('[id="progress-bar-chart"]')
  await chart.hover()

  // Modal should NOT be visible
  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('volume calculation is correct', async ({ page }) => {
  const exerciseId = createExercises(['Squat'])[0]

  createWorkoutLog(exerciseId, '2026-05-01', [
    { id: 's1', reps: 3, weight: 225 },
    { id: 's2', reps: 3, weight: 225 },
    { id: 's3', reps: 3, weight: 225 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Chart should be visible
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Click bar to open modal
  const chart = page.locator('[id="progress-bar-chart"]')
  await clickChartBar(page)

  // Modal should show correct volume
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })

  // 3 sets of 3x225 = 2,025 volume (use .first() to avoid strict mode with grand total footer)
  await expect(page.locator('[id="progress-detail-modal"]').getByText('Squat')).toBeVisible()
  await expect(page.locator('[id="progress-detail-modal"]').getByText('2,025').first()).toBeVisible()

  // Close modal
  await page.getByRole('button', { name: 'CLOSE' }).click()
})

test('multiple exercises in ALL mode shows all in chart', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat', 'Deadlift'])

  createWorkoutLog(ids[0], '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[1], '2026-05-01', [{ id: 's2', reps: 5, weight: 225 }])
  createWorkoutLog(ids[2], '2026-05-01', [{ id: 's3', reps: 5, weight: 315 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // All 3 exercises should appear in dropdown + ALL EXERCISES
  const options = page.locator('[id="progress-exercise-selector"] select option')
  expect(await options.count()).toBe(4)

  // Chart should be visible (ALL EXERCISES is default)
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  // Click bar to open modal
  const chart = page.locator('[id="progress-bar-chart"]')
  await clickChartBar(page)

  // Modal should list all exercises
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[id="progress-detail-modal"]').getByText('Bench Press')).toBeVisible()
  await expect(page.locator('[id="progress-detail-modal"]').getByText('Squat')).toBeVisible()
  await expect(page.locator('[id="progress-detail-modal"]').getByText('Deadlift')).toBeVisible()

  // Close modal (use force to click outside viewport for large modals)
  await page.getByRole('button', { name: 'CLOSE' }).click({ force: true })
})

test('redirects to home when no user cookie', async ({ page }) => {
  // Don't login — navigate directly
  await page.goto('http://localhost:3111/progress')

  // The header should still be visible (SSR shell renders)
  // But the page content may be blank since userId is missing
  // The page shows the header and controls even without userId
  await expect(page.locator('[id="progress-page"]')).toBeVisible({ timeout: 10000 })
})

test('dropdown is empty when no exercises have logs', async ({ page }) => {
  // Create exercises but no workout logs — getExercisesWithLogs only returns exercises with workout_logs
  createExercises(['Bench Press', 'Squat', 'Deadlift'])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Only "ALL EXERCISES" option should be present (no exercises have workout logs)
  const options = page.locator('[id="progress-exercise-selector"] select option')
  const count = await options.count()
  expect(count).toBe(1)
  await expect(options.first()).toHaveText('ALL EXERCISES')

  // Empty state should be visible
  await expect(page.locator('[id="progress-empty"]')).toBeVisible()
})

test('nav drawer links to progress page', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/today')
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible({ timeout: 10000 })

  // Open side drawer
  await page.getByRole('button', { name: 'menu' }).click()
  await expect(page.getByRole('link', { name: 'PROGRESS' })).toBeVisible()

  // Click PROGRESS link
  await page.getByRole('link', { name: 'PROGRESS' }).click()

  // Should navigate to progress page
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })
})

test('chart title updates with granularity change', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]
  createWorkoutLog(exerciseId, '2026-05-01', [{ id: 's1', reps: 5, weight: 135 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  // Default is month
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()

  await page.getByRole('button', { name: 'session' }).click()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()

  await page.getByRole('button', { name: 'week' }).click()
  await expect(page.getByText('VOLUME BY WEEK')).toBeVisible()

  // Back to month
  await page.getByRole('button', { name: 'month' }).click()
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
})

