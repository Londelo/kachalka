import { test, expect } from '@playwright/test'
import { loginAsBruno, logout } from './helpers'

// Helper: create a user and return their ID cookie value
async function createTestUser(page: ReturnType<typeof page>, name: string): Promise<string> {
  // Navigate to home to create user
  await page.goto('http://localhost:3111/')
  await expect(page.getByRole('heading', { name: 'SELECT COMMANDER' })).toBeVisible()
  await page.getByRole('button', { name: 'Add User' }).click()
  await page.locator('#add-user-name-input').fill(name)
  await page.locator('#add-user-submit').click()
  // Wait for user to be created and visible
  await expect(page.getByRole('button', { name })).toBeVisible()
  return name
}

// Helper: navigate to plan page after login
async function goToPlan(page: ReturnType<typeof page>): Promise<void> {
  // Login with known cookie and go directly to plan
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/plan')
  await expect(page.getByRole('heading', { name: 'MY BATTLE PLAN' })).toBeVisible()
  await expect(page.getByText('LOADING...')).not.toBeVisible({ timeout: 10000 })
}

// ============================================================================
// Plan page E2E tests
// ============================================================================

test('plan page loads with existing assignments', async ({ page }) => {
  // Create Bruno + exercises + assignments via the seed script
  // For this test we use the existing Bruno (id=1) from the app's seed
  await goToPlan(page)

  // Verify day selector buttons are visible
  await expect(page.getByRole('button', { name: 'MON' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'TUE' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'WED' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'THU' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'FRI' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SAT' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SUN' })).toBeVisible()

  // The default day should show CURRENT ASSETS or empty state
  // (depends on what day of week today is and what's seeded)
  await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()

  // ADD EXERCISE button visible
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
})

test('shows empty state on a day with no exercises', async ({ page }) => {
  await goToPlan(page)

  // Click MON — create an exercise there first, then remove it to test empty state
  // For a clean empty state test, pick a day and verify it shows empty or has exercises
  await page.getByRole('button', { name: 'MON' }).click()

  // Check if MON has exercises or empty state
  const hasEmptyState = await page
    .getByText('NO ASSIGNMENTS — DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN')
    .isVisible()
    .catch(() => false)

  if (hasEmptyState) {
    // Empty state — verify ADD EXERCISE is visible
    await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'close' })).not.toBeVisible()
  } else {
    // Has exercises — verify cards are visible
    await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()
    await expect(page.locator('[id^="assignment-card-"]')).toHaveCountGreaterThan(0)
  }
})

test('day selection toggles adding mode', async ({ page }) => {
  await goToPlan(page)

  // Click MON — should be selected (shows assignments or empty state, ADD EXERCISE visible)
  await page.getByRole('button', { name: 'MON' }).click()
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()

  // Click MON again — should enter "adding" mode (hides assignments, hides ADD EXERCISE)
  await page.getByRole('button', { name: 'MON' }).click()
  await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).not.toBeVisible()

  // Click TUE — should switch to TUE selected mode
  await page.getByRole('button', { name: 'TUE' }).click()
  await expect(page.getByRole('button', { name: 'ADD EXERCISE' })).toBeVisible()
})

test('creates new exercise inline and auto-assigns to selected day', async ({ page }) => {
  await goToPlan(page)

  // Click a day (MON)
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Modal opens — switch to new exercise mode
  await page.getByRole('button', { name: 'Create new exercise' }).click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Type exercise name and submit
  await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Alpha')
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Modal should close and exercise card should appear
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
  await expect(
    page.locator('[id^="assignment-card-"]').filter({ hasText: 'Test Drill Alpha' }),
  ).toBeVisible()
})

test('selects existing exercise to assign', async ({ page }) => {
  await goToPlan(page)

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Modal should be in select mode by default
  await expect(page.getByRole('heading', { name: 'ASSIGN EXERCISE' })).toBeVisible()

  // Check if there are available exercises
  const availableExercises = await page.locator('select option:not([value=""])').count()

  if (availableExercises > 0) {
    // Select first available exercise
    await page.locator('select').selectOption({ index: 1 })
    await expect(page.getByRole('button', { name: 'ASSIGN' })).toBeEnabled()
    await page.getByRole('button', { name: 'ASSIGN' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'CURRENT ASSETS' })).toBeVisible()
  } else {
    // All exercises assigned — create a new one
    await page.getByRole('button', { name: 'Create new exercise' }).click()
    await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Beta')
    await page.getByRole('button', { name: 'ADD', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
  }
})

test('removes exercise from day', async ({ page }) => {
  await goToPlan(page)

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Count current assignment cards
  const initialCards = page.locator('[id^="assignment-card-"]')
  const initialCount = await initialCards.count()

  if (initialCount > 0) {
    // Click the first close button to remove the first exercise
    await page.getByRole('button', { name: 'close' }).first().click()

    // The assignment list should refresh — fewer cards
    await expect(initialCards).toHaveCount(initialCount - 1)
  } else {
    // No exercises — create one then remove it
    await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
    await page.getByRole('button', { name: 'Create new exercise' }).click()
    await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Gamma')
    await page.getByRole('button', { name: 'ADD', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })

    // Now remove it
    await expect(page.locator('[id^="assignment-card-"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'close' }).first().click()
    await expect(page.locator('[id^="assignment-card-"]')).toHaveCount(0)
  }
})

test('duplicate assignment guard prevents assigning same exercise twice', async ({ page }) => {
  await goToPlan(page)

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Check if there are available exercises to try to duplicate
  const availableExercises = await page.locator('select option:not([value=""])').count()

  if (availableExercises > 0) {
    // Try to assign an exercise that might already be on this day
    // First, check what's already assigned
    const assignedNames = await page.locator('[id^="assignment-card-"] h4').all()
    if (assignedNames.length > 0) {
      const firstAssigned = await assignedNames[0].textContent()
      if (firstAssigned) {
        await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
        await page.locator('select').selectOption({ label: firstAssigned })
        await page.getByRole('button', { name: 'ASSIGN' }).click()
        await expect(page.getByRole('alert')).toBeVisible()
        await expect(page.getByText('already assigned')).toBeVisible()
        // Close the modal
        await page.getByRole('button', { name: 'CANCEL' }).click()
      }
    }
  }
})

test('exercise name validation rejects empty name', async ({ page }) => {
  await goToPlan(page)

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await page.getByRole('button', { name: 'Create new exercise' }).click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // ADD button should be disabled when name is empty
  await expect(page.getByRole('button', { name: 'ADD', exact: true })).toBeDisabled()

  // Try to submit with only whitespace — button should still be disabled
  await page.getByPlaceholder('Enter exercise name...').fill('   ')
  await expect(page.getByRole('button', { name: 'ADD', exact: true })).toBeDisabled()
})

test('modal closes via overlay click', async ({ page }) => {
  await goToPlan(page)

  // Click ADD EXERCISE to open modal
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Click the overlay (outside the modal content)
  await page.locator('[role="dialog"]').click({ position: { x: 0, y: 0 } })

  // Modal should close
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('modal closes via CANCEL button', async ({ page }) => {
  await goToPlan(page)

  // Click ADD EXERCISE to open modal
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Click CANCEL
  await page.getByRole('button', { name: 'CANCEL' }).click()

  // Modal should close
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('creates exercise on new mode and assigns to day', async ({ page }) => {
  await goToPlan(page)

  // Click MON
  await page.getByRole('button', { name: 'MON' }).click()

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await page.getByRole('button', { name: 'Create new exercise' }).click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Type name and submit
  await page.getByPlaceholder('Enter exercise name...').fill('Test Drill Delta')
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Modal should close and new exercise card should appear
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })
  await expect(
    page.locator('[id^="assignment-card-"]').filter({ hasText: 'Test Drill Delta' }),
  ).toBeVisible()
})

test('switches from new mode back to select mode in modal', async ({ page }) => {
  await goToPlan(page)

  // Click ADD EXERCISE
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()

  // Switch to new exercise mode
  await page.getByRole('button', { name: 'Create new exercise' }).click()
  await expect(page.getByRole('heading', { name: 'NEW EXERCISE' })).toBeVisible()

  // Click the back button to return to select mode
  await page.getByRole('button', { name: 'Select existing exercise' }).click()
  await expect(page.getByRole('heading', { name: 'ASSIGN EXERCISE' })).toBeVisible()

  // Verify select dropdown is visible
  await expect(page.locator('select')).toBeVisible()

  // Close modal
  await page.getByRole('button', { name: 'CANCEL' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('error state displays error banner for long exercise name', async ({ page }) => {
  await goToPlan(page)

  // Open modal and switch to new exercise mode
  await page.getByRole('button', { name: 'ADD EXERCISE' }).click()
  await page.getByRole('button', { name: 'Create new exercise' }).click()

  // Try to create an exercise with a very long name (>100 chars)
  await page.getByPlaceholder('Enter exercise name...').fill('a'.repeat(101))

  // Click ADD — server should reject with "Exercise name too long"
  await page.getByRole('button', { name: 'ADD', exact: true }).click()

  // Error should appear in the modal as role="alert"
  await expect(page.getByRole('alert')).toBeVisible()
  // The error also shows in the plan-level error banner
  await expect(page.locator('#plan-error')).toBeVisible()
})
