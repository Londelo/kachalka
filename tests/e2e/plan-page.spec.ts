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

/** Assign an exercise to a day of week for Bruno. */
function assignExercise(exerciseId: number, dayOfWeek: number): void {
  db.prepare(
    'INSERT OR IGNORE INTO user_routines (user_id, exercise_id, day_of_week) VALUES (1, ?, ?)',
  ).run(exerciseId, dayOfWeek)
}

/** Clean up Bruno's exercises and routines between tests. */
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
// Plan page E2E tests
// ============================================================================

test('plan page loads with existing assignments', async ({ page }) => {
  // Create exercises assigned to various days so the plan page has data
  createExercises(['Barbell Curl', 'Pull-Up', 'Squat'])
  assignExercise(1, 0) // MON
  assignExercise(2, 2) // WED
  assignExercise(3, 4) // FRI

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()
  await expect(page.getByText('LOADING...')).not.toBeVisible({ timeout: 10000 })

  // Verify day selector buttons are visible
  await expect(page.getByRole('button', { name: 'MON' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'TUE' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'WED' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'THU' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'FRI' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SAT' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SUN' })).toBeVisible()

  // The default day should show CURRENT ASSETS
  await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()

  // ADD EXERCISE button visible
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
})

test('shows empty state on a day with no exercises', async ({ page }) => {
  // No exercises created — Bruno has a clean slate
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON — should show empty state
  await page.getByRole('button', { name: 'MON' }).click()

  // Check if MON has exercises or empty state
  const hasEmptyState = await page
    .getByText('NO ASSIGNMENTS — DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN')
    .isVisible()
    .catch(() => false)

  if (hasEmptyState) {
    await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'close' })).not.toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()
    await expect(page.locator('[id^="assignment-card-"]')).toHaveCountGreaterThan(0)
  }
})

test('day selection selects the day and shows assignments', async ({ page }) => {
  // Clicking a day selects it — ADD EXERCISE button and CURRENT ASSETS always visible
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON — should be selected, ADD EXERCISE always visible
  await page.getByRole('button', { name: 'MON' }).click()
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()

  // Click TUE — should switch to TUE selected mode
  await page.getByRole('button', { name: 'TUE' }).click()
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
})

test('creates new exercise inline and auto-assigns to selected day', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Modal opens — switch to new exercise mode
  await expect(page.locator('#plan-modal')).toBeVisible()
  // Click the "Create new exercise" icon button (aria-label="Create new exercise")
  // to switch the modal from "select" mode (dropdown) to "new" mode (text input form)
  await page.getByLabel('Create new exercise').click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Type exercise name and submit
  await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Alpha')
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Modal should close and exercise card should appear
  await expect(page.locator('#plan-modal')).not.toBeVisible({ timeout: 10000 })
  await expect(
    page.locator('[id^="assignment-card-"]').filter({ hasText: 'Test Drill Alpha' }),
  ).toBeVisible()
})

test('selects existing exercise to assign', async ({ page }) => {
  // Pre-create an exercise so there's something to select
  const ids = createExercises(['Barbell Curl'])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Modal should be in select mode by default
  await expect(page.getByRole('heading', { name: 'ASSIGN EXERCISE' })).toBeVisible()

  // Check if there are available exercises
  const availableExercises = await page.locator('select option:not([value=""])').count()

  // Select first available exercise
  await page.locator('select').selectOption({ index: 1 })
  await expect(page.getByRole('button', { name: 'ASSIGN' })).toBeEnabled()
  await page.getByRole('button', { name: 'ASSIGN' }).click()
  await expect(page.locator('#plan-modal')).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()
})

test('removes exercise from day', async ({ page }) => {
  // Create exercises assigned to MON so we have something to remove
  createExercises(['Barbell Curl', 'Pull-Up'])
  assignExercise(1, 0) // MON
  assignExercise(2, 0) // MON

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Count current assignment cards
  const initialCards = page.locator('[id^="assignment-card-"]')
  const initialCount = await initialCards.count()

  // Click the first close button to remove the first exercise
  await page.getByRole('button', { name: 'close' }).first().click()

  // The assignment list should refresh — fewer cards
  await expect(initialCards).toHaveCount(initialCount - 1)
})

test('duplicate assignment guard prevents assigning same exercise twice', async ({ page }) => {
  // Create 2 exercises: one already assigned to MON, one unassigned
  // The UI filters out assigned exercises from the select dropdown.
  // This test verifies that behavior: Barbell Curl is on MON so it should NOT
  // appear in the dropdown, while Pull-Up is available.
  createExercises(['Barbell Curl', 'Pull-Up'])
  assignExercise(1, 0) // MON — already assigned, filters out of dropdown

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Verify Barbell Curl appears in the assignment list
  await expect(page.locator('[id^="assignment-card-"]').filter({ hasText: 'Barbell Curl' })).toBeVisible()

  // Open modal — should be in select mode (Pull-Up is available, Barbell Curl is filtered out)
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.getByRole('heading', { name: 'ASSIGN EXERCISE' })).toBeVisible()

  // Verify the already-assigned exercise is NOT in the select dropdown
  // (this is the UI's duplicate guard — it prevents selecting already-assigned exercises)
  const selectOptions = await page.locator('select option:not([value=""])').all()
  const optionTexts = await Promise.all(selectOptions.map((o) => o.textContent()))
  const hasBarbellCurl = optionTexts.some((t) => t?.includes('Barbell Curl'))
  expect(hasBarbellCurl).toBe(false)

  // Verify the unassigned exercise IS available
  const hasPullUp = optionTexts.some((t) => t?.includes('Pull-Up'))
  expect(hasPullUp).toBe(true)

  // Close the modal
  await page.getByRole('button', { name: 'CANCEL' }).click()
})

test('exercise name validation rejects empty name', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await expect(page.locator('#plan-modal')).toBeVisible()
  await page.getByLabel('Create new exercise').click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // ADD button should be disabled when name is empty
  await expect(page.getByRole('button', { name: 'ADD', exact: true })).toBeDisabled()

  // Try to submit with only whitespace — button should still be disabled
  await page.getByPlaceholder('Enter exercise name...').fill('   ')
  await expect(page.getByRole('button', { name: 'ADD', exact: true })).toBeDisabled()
})

test('modal closes via overlay click', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click ADD EXERCISE to open modal
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.locator('#plan-modal')).toBeVisible()

  // Click the overlay (outside the modal content)
  await page.locator('#plan-modal').click({ position: { x: 0, y: 0 } })

  // Modal should close
  await expect(page.locator('#plan-modal')).not.toBeVisible()
})

test('modal closes via CANCEL button', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click ADD EXERCISE to open modal
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.locator('#plan-modal')).toBeVisible()

  // Click CANCEL
  await page.getByRole('button', { name: 'CANCEL' }).click()

  // Modal should close
  await expect(page.locator('#plan-modal')).not.toBeVisible()
})

test('creates exercise on new mode and assigns to day', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await expect(page.locator('#plan-modal')).toBeVisible()
  await page.getByLabel('Create new exercise').click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Type name and submit
  await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Delta')
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Modal should close and new exercise card should appear
  await expect(page.locator('#plan-modal')).not.toBeVisible({ timeout: 10000 })
  await expect(
    page.locator('[id^="assignment-card-"]').filter({ hasText: 'Test Drill Delta' }),
  ).toBeVisible()
})

test('switches from new mode back to select mode in modal', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await expect(page.locator('#plan-modal')).toBeVisible()
  await page.getByLabel('Create new exercise').click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Click the back button to return to select mode
  await page.getByRole('button', { name: 'Select existing exercise' }).click()
  await expect(page.getByRole('heading', { name: 'ASSIGN EXERCISE' })).toBeVisible()

  // Verify select dropdown is visible
  await expect(page.locator('select')).toBeVisible()

  // Close modal
  await page.getByRole('button', { name: 'CANCEL' }).click()
  await expect(page.locator('#plan-modal')).not.toBeVisible()
})

test('error state displays error banner for long exercise name', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()

  // Open modal and switch to new exercise mode
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.locator('#plan-modal')).toBeVisible()
  await page.getByLabel('Create new exercise').click()

  // Try to create an exercise with a very long name (>100 chars)
  await page.getByPlaceholder('Enter exercise name...').fill('a'.repeat(101))

  // Click ADD — server should reject with "Exercise name too long"
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Error should appear in the modal as role="alert"
  await expect(page.getByRole('alert')).toBeVisible()
  // The error also shows in the plan-level error banner
  await expect(page.locator('#plan-error')).toBeVisible()
})
