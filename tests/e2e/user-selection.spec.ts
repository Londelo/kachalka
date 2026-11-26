import { test, expect } from '@playwright/test'

import { ensureSchema, openE2eDatabase, wipeE2eData } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'

const BASE_URL = getE2eBaseUrl()

const db = openE2eDatabase()
ensureSchema(db)

test.beforeEach(() => {
  ensureSchema(db)
  wipeE2eData(db)
  db.exec('DELETE FROM sqlite_sequence')
})

test('full user selection flow', async ({ page }) => {
  // ---- Step 1: Create Bruno ----
  await page.goto(`${BASE_URL}/`)
  await expect(page.getByRole('heading', { name: 'SELECT COMMANDER' })).toBeVisible()
  await page.getByRole('button', { name: 'Add User' }).click()
  await expect(page.locator('#add-user-modal')).toBeVisible()
  await page.locator('#add-user-name-input').fill('Bruno')
  await page.locator('#add-user-submit').click()

  // ---- Step 2: Verify Bruno exists and navigate to today ----
  await expect(page.getByRole('button', { name: 'Bruno' })).toBeVisible()
  await page.getByRole('button', { name: 'Bruno' }).click()
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible({ timeout: 10000 })

  // ---- Step 3: Navigate back to user selection ----
  await page.getByRole('link', { name: 'account_circle' }).click()
  await expect(page.getByRole('heading', { name: 'SELECT COMMANDER' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bruno' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible()

  // ---- Step 4: Test cancellation flow ----
  await page.getByRole('button', { name: 'Add User' }).click()
  await expect(page.locator('#add-user-modal')).toBeVisible()
  await page.locator('#add-user-name-input').fill('GhostUser')
  await page.locator('#add-user-cancel').click()
  // Verify the modal closed and cancelled user was never created
  await expect(page.locator('#add-user-modal')).toBeHidden()
  await expect(page.getByRole('button', { name: 'GhostUser' })).not.toBeVisible()

  // ---- Step 5: Create another user and navigate ----
  await page.getByRole('button', { name: 'Add User' }).click()
  await expect(page.locator('#add-user-modal')).toBeVisible()
  await page.locator('#add-user-name-input').fill('testuser')
  await page.locator('#add-user-submit').click()
  await expect(page.getByRole('button', { name: 'testuser' })).toBeVisible()
  await page.getByRole('button', { name: 'testuser' }).click()
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible()
  await expect(page.locator('div').filter({ hasText: 'No workout scheduled. Set up' })).toBeVisible()
})
