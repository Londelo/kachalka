import Database from 'better-sqlite3'
import { test, expect, type Page } from '@playwright/test'
import { loginAsBruno } from './helpers'

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

db.exec('DELETE FROM workout_logs')
db.exec('DELETE FROM user_routines')
db.exec('DELETE FROM exercises')
db.exec('DELETE FROM users')
db.exec('DELETE FROM sqlite_sequence')

function createExercises(names: string[]): number[] {
  const ids: number[] = []
  const insert = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, 1)')
  for (const name of names) {
    const info = insert.run(name)
    ids.push(Number(info.lastInsertRowid))
  }
  return ids
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

function fullDateBadge(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function createWorkoutLog(exerciseId: number, date: string, sets: { id: string; reps: number; weight: number }[]): void {
  const jsonSets = JSON.stringify(sets)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)',
  ).run(exerciseId, date, jsonSets, now, now)
}

function cleanupBruno(): void {
  db.exec('DELETE FROM workout_logs WHERE user_id = 1')
  db.exec('DELETE FROM user_routines WHERE user_id = 1')
  db.exec('DELETE FROM exercises WHERE user_id = 1')
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'exercises'")
}

test.beforeEach(async ({ page }) => {
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
})

test.afterEach(() => {
  cleanupBruno()
})

async function clickChartBar(page: Page) {
  await page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first().click()
}

async function openBarModal(page: Page) {
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })
  await clickChartBar(page)
  await expect(page.locator('[id="progress-detail-modal"]')).toBeVisible({ timeout: 5000 })
}

test('progress page loads with header and controls', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-exercise-selector"]')).toBeVisible()
  await expect(page.locator('[id="progress-exercise-selector"] select')).toBeVisible()

  await expect(page.getByRole('button', { name: '6M' })).toBeVisible()
  await expect(page.getByRole('button', { name: '1Y' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible()

  await expect(page.getByRole('button', { name: 'session' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'week' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'month' })).toBeVisible()

  await expect(page.getByRole('button', { name: '6M' })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: 'month' })).toHaveClass(/bg-primary/)
})

test('shows empty state when no workout data exists', async ({ page }) => {
  createExercises(['Bench Press', 'Squat'])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-empty"]')).toBeVisible()
  await expect(page.getByText('NO DATA YET')).toBeVisible()
  await expect(page.getByText('LOG WORKOUTS TO SEE PROGRESSION')).toBeVisible()

  await expect(page.locator('[id="progress-bar-chart"]')).not.toBeVisible()
})

test('shows chart bars when workout data exists', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]
  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
  ])
  createWorkoutLog(exerciseId, daysAgo(17), [
    { id: 's2', reps: 5, weight: 140 },
  ])
  createWorkoutLog(exerciseId, daysAgo(24), [
    { id: 's3', reps: 5, weight: 145 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('LOADING...')).not.toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()

  await expect(page.locator('[id="progress-empty"]')).not.toBeVisible()
})

test('exercise dropdown lists exercises with workout logs', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Pull-Up', 'Squat'])
  createWorkoutLog(ids[0], daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[2], daysAgo(10), [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  const options = page.locator('[id="progress-exercise-selector"] select option')
  await expect(options).toHaveCount(3)

  await expect(options.first()).toHaveText('ALL EXERCISES')

  const texts = await options.allTextContents()
  expect(texts).toEqual(expect.arrayContaining(['ALL EXERCISES', 'Bench Press', 'Squat']))
})

test('selecting an exercise filters chart to that exercise', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat'])

  createWorkoutLog(ids[0], daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[1], daysAgo(10), [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  await page.locator('[id="progress-exercise-selector"] select').selectOption('Squat')

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
})

test('selecting ALL EXERCISES shows aggregated data', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat'])

  createWorkoutLog(ids[0], daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[1], daysAgo(10), [{ id: 's2', reps: 5, weight: 225 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  await page.locator('[id="progress-exercise-selector"] select').selectOption('Bench Press')
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()

  await page.locator('[id="progress-exercise-selector"] select').selectOption('')
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes time range when clicking 6M pill', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(900), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's2', reps: 5, weight: 140 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'ALL' }).click()

  await expect(page.getByRole('button', { name: 'ALL' })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: '6M' })).not.toHaveClass(/bg-primary/)

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes time range when clicking 1Y pill', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(240), [{ id: 's1', reps: 5, weight: 135 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: '1Y' }).click()
  await expect(page.getByRole('button', { name: '1Y' })).toHaveClass(/bg-primary/)
  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible()
})

test('changes granularity between session week and month', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(exerciseId, daysAgo(17), [{ id: 's2', reps: 5, weight: 140 }])
  createWorkoutLog(exerciseId, daysAgo(24), [{ id: 's3', reps: 5, weight: 145 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
  await expect(page.getByRole('button', { name: 'month' })).toHaveClass(/bg-primary/)

  await page.getByRole('button', { name: 'session' }).click()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()
  await expect(page.getByRole('button', { name: 'session' })).toHaveClass(/bg-primary/)
  await expect(page.getByRole('button', { name: 'month' })).not.toHaveClass(/bg-primary/)

  await page.getByRole('button', { name: 'week' }).click()
  await expect(page.getByText('VOLUME BY WEEK')).toBeVisible()
  await expect(page.getByRole('button', { name: 'week' })).toHaveClass(/bg-primary/)
})

test('clicking a bar opens detail modal', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)
})

test('modal shows date, exercise name, and metrics', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  const sessionDate = daysAgo(10)
  createWorkoutLog(exerciseId, sessionDate, [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')

  await expect(modal.getByText(fullDateBadge(sessionDate))).toBeVisible()

  await expect(modal.getByText('Bench Press')).toBeVisible()
  await expect(modal.getByText(/sets/)).toBeVisible()
  await expect(modal.getByText(/reps/)).toBeVisible()
  await expect(modal.getByText(/vol/)).toBeVisible()
  await expect(modal.getByText(/max lb/)).toBeVisible()

  await expect(modal.getByText('TOTAL VOLUME')).toBeVisible()
  await expect(modal.getByText('1,140').first()).toBeVisible()

  await expect(page.getByRole('button', { name: 'CLOSE' })).toBeVisible()
})

test('closing modal via close button dismisses it', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  await page.getByRole('button', { name: 'CLOSE' }).click()

  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('closing modal via backdrop click dismisses it', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  await page.locator('[id="progress-detail-modal"]').click({ position: { x: 0, y: 0 } })

  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('modal does not open on hover', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })
  await page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first().hover()

  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

test('volume calculation is correct', async ({ page }) => {
  const exerciseId = createExercises(['Squat'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 3, weight: 225 },
    { id: 's2', reps: 3, weight: 225 },
    { id: 's3', reps: 3, weight: 225 },
  ])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  await expect(modal.getByText('Squat')).toBeVisible()
  await expect(modal.getByText('2,025').first()).toBeVisible()

  await page.getByRole('button', { name: 'CLOSE' }).click()
})

test('multiple exercises in ALL mode shows all in chart', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat', 'Deadlift'])

  createWorkoutLog(ids[0], daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])
  createWorkoutLog(ids[1], daysAgo(10), [{ id: 's2', reps: 5, weight: 225 }])
  createWorkoutLog(ids[2], daysAgo(10), [{ id: 's3', reps: 5, weight: 315 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  const options = page.locator('[id="progress-exercise-selector"] select option')
  await expect(options).toHaveCount(4)

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  await clickChartBar(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  await expect(modal).toBeVisible({ timeout: 5000 })
  await expect(modal.getByText('Bench Press')).toBeVisible()
  await expect(modal.getByText('Squat')).toBeVisible()
  await expect(modal.getByText('Deadlift')).toBeVisible()

  await page.getByRole('button', { name: 'CLOSE' }).click({ force: true })
})

test('redirects to home when no user cookie', async ({ page }) => {
  await page.goto('http://localhost:3111/progress')

  await expect(page.locator('[id="progress-page"]')).toBeVisible({ timeout: 10000 })
})

test('dropdown is empty when no exercises have logs', async ({ page }) => {
  createExercises(['Bench Press', 'Squat', 'Deadlift'])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  const options = page.locator('[id="progress-exercise-selector"] select option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toHaveText('ALL EXERCISES')

  await expect(page.locator('[id="progress-empty"]')).toBeVisible()
})

test('nav drawer links to progress page', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/today')
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'menu' }).click()
  await expect(page.getByRole('link', { name: 'PROGRESS' })).toBeVisible()

  await page.getByRole('link', { name: 'PROGRESS' }).click()

  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })
})

test('chart title updates with granularity change', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]
  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135 }])

  await loginAsBruno(page)
  await page.goto('http://localhost:3111/progress')
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()

  await page.getByRole('button', { name: 'session' }).click()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()

  await page.getByRole('button', { name: 'week' }).click()
  await expect(page.getByText('VOLUME BY WEEK')).toBeVisible()

  await page.getByRole('button', { name: 'month' }).click()
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
})

