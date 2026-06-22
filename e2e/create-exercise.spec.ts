import { test, expect } from '@playwright/test'
import { loginAsBruno } from './helpers'

test('create new exercise flow on plan page', async ({ page }) => {
  // Collect console errors and warnings
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`${msg.type()}: ${msg.text()}`)
    }
  })

  // Authenticate as Bruno (id=1 from seed)
  await loginAsBruno(page)

  // Navigate to plan page
  await page.goto('/plan')
  await page.waitForSelector('#plan-page', { timeout: 10000 })

  // Step 2: Click TUE to get into "select mode" for a day (adds ADD EXERCISE button)
  const tueBtn = page.locator('button', { hasText: /^TUE$/ })
  await tueBtn.click()

  // Step 3: Click the "ADD EXERCISE" button
  const addExerciseBtn = page.locator('button', { hasText: 'ADD EXERCISE' })
  await expect(addExerciseBtn).toBeVisible({ timeout: 5000 })
  await addExerciseBtn.click()

  // Step 4: Click the + icon button to switch to NEW EXERCISE mode
  const newExerciseBtn = page.locator('[aria-label="Create new exercise"]')
  await expect(newExerciseBtn).toBeVisible()
  await newExerciseBtn.click()

  // Step 5: Type a new exercise name
  await expect(page.locator('#add-existing-exercise-modal input[type="text"]')).toBeVisible({ timeout: 5000 })
  const nameInput = page.locator('#add-existing-exercise-modal input[type="text"]')
  await nameInput.fill('Deadlift')

  // Step 6: Click the "ADD" button
  const addBtn = page.locator('button', { hasText: /^ADD$/ })
  await addBtn.click()

  // Step 7: Wait for the assignment card to appear instead of a blind sleep
  await expect(page.locator('[id^="assignment-card-"]').first()).toBeVisible({ timeout: 5000 })

  // Check for errors
  const errorElement = page.locator('#plan-error')
  const hasError = await errorElement.isVisible({ timeout: 3000 }).catch(() => false)

  if (hasError) {
    const errorText = await errorElement.textContent()
    console.log(`ERROR DISPLAYED: ${errorText}`)
  }

  // Check if modal is still open (indicates failure)
  const modalStillOpen = await page.locator('#add-existing-exercise-modal').isVisible().catch(() => false)
  if (modalStillOpen) {
    console.log('ERROR: Modal is still open after clicking ADD')
  }

  // Print any console errors
  if (consoleErrors.length > 0) {
    console.log('Console errors/warnings:', consoleErrors)
  }

  // Verify the exercise was created
  const exerciseCard = page.locator('[id^="assignment-card-"]').first()
  const exerciseVisible = await exerciseCard.isVisible({ timeout: 3000 }).catch(() => false)

  console.log(`Exercise card visible: ${exerciseVisible}`)
  console.log(`Modal still open: ${modalStillOpen}`)
  console.log(`Error displayed: ${hasError}`)

  // Take a screenshot for debugging
  await page.screenshot({ path: 'e2e/screenshots/create-exercise-failure.png' })

  expect(hasError).toBe(false)
})
