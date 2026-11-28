import { test, expect, type Page, type Locator } from '@playwright/test'

import { ensureSchema, openE2eDatabase, wipeE2eData } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

const BASE_URL = getE2eBaseUrl()

const db = openE2eDatabase()
ensureSchema(db, process.cwd())

wipeE2eData(db)
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

type WorkoutLine = { id?: string; reps: number; weight: number; count?: number }

// 'production' stores the column the way repo create()/update() do — JSON.stringify before
// Drizzle's text('sets', { mode: 'json' }) stringifies again — so the row lands double-encoded
// and the read path parses it back once. 'legacy' is the single-encoded shape older rows hold.
function createWorkoutLog(
  exerciseId: number,
  date: string,
  sets: WorkoutLine[],
  storage: 'production' | 'legacy' = 'legacy',
): void {
  const jsonSets = storage === 'production' ? JSON.stringify(JSON.stringify(sets)) : JSON.stringify(sets)
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
  ensureSchema(db, process.cwd())
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')

  await expect(modal.getByText(fullDateBadge(sessionDate))).toBeVisible()

  await expect(modal.getByText('Bench Press')).toBeVisible()
  await expect(modal.getByText('2 sets', { exact: true })).toBeVisible()
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)
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
  await page.goto(`${BASE_URL}/progress`)

  await expect(page.locator('[id="progress-page"]')).toBeVisible({ timeout: 10000 })
})

test('dropdown is empty when no exercises have logs', async ({ page }) => {
  createExercises(['Bench Press', 'Squat', 'Deadlift'])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  const options = page.locator('[id="progress-exercise-selector"] select option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toHaveText('ALL EXERCISES')

  await expect(page.locator('[id="progress-empty"]')).toBeVisible()
})

test('nav drawer links to progress page', async ({ page }) => {
  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/today`)
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
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()

  await page.getByRole('button', { name: 'session' }).click()
  await expect(page.getByText('VOLUME BY SESSION')).toBeVisible()

  await page.getByRole('button', { name: 'week' }).click()
  await expect(page.getByText('VOLUME BY WEEK')).toBeVisible()

  await page.getByRole('button', { name: 'month' }).click()
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()
})

// One line standing for three sets, stored double-encoded the way repo create()/update()
// store it. Three uncounted 5@135 lines produce the same 2,025 volume and are already
// covered above; only this shape separates a count-aware reader from a count-blind one —
// the bar and the modal that bar opens must both read 3 sets, 15 reps and 2,025.
test('a counted session reads the same sets, reps and volume on the bar and in the modal it opens', async ({ page }) => {
  const exerciseId = createExercises(['Deadlift'])[0]

  createWorkoutLog(
    exerciseId,
    daysAgo(10),
    [{ id: 's1', reps: 5, weight: 135, count: 3 }],
    'production',
  )

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  await expect(modal.getByText('Deadlift')).toBeVisible()
  await expect(modal.getByText('3 sets', { exact: true })).toBeVisible()
  await expect(modal.getByText('15 reps', { exact: true })).toBeVisible()
  await expect(modal.getByText('2,025 vol', { exact: true })).toBeVisible()
  await expect(modal.getByText('135 max lb', { exact: true })).toBeVisible()

  // The footer is the bar's own volume — the figure the bar's height is drawn from — so
  // reading 2,025 here and 2,025 in the row above is the agreement the modal used to break.
  await expect(
    modal.locator('p').filter({ hasText: 'TOTAL VOLUME' }).locator('..').locator('p').nth(1),
  ).toHaveText('2,025')
})

// Two calendar days that always share a month and always sit in the past, so a month
// group is never split by the wall clock the suite runs against.
function datesInOneMonth(): [string, string] {
  const now = new Date()
  const month = now.getUTCMonth()
  const year = now.getUTCFullYear()
  const key = month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, '0')}`
  return [`${key}-01`, `${key}-02`]
}

function breakdownRow(page: Page, modal: Locator, name: string): Locator {
  return modal
    .locator('[data-id="progress-exercise-row"]')
    .filter({
      has: page.locator('[data-id="progress-exercise-name"]', {
        hasText: new RegExp(`^${name}$`),
      }),
    })
}

function tooltipFigure(page: Page, figure: 'sets' | 'reps' | 'volume'): Locator {
  return page.locator(`[data-id="progress-tooltip-${figure}"]`)
}

// The feature's acceptance test. One stored line, performed three times: a reader that
// ignores `count` calls it 1 set / 5 reps / 675, so every figure below is one the
// count-blind path cannot produce. Asserted on the data-id hooks the frontend tickets
// hung on the breakdown and the grand total, so the contract the epic tier targets is
// the contract proved here.
test('counted set line reads 2,025 on the bar and in the breakdown', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135, count: 3 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle')).toHaveCount(1)

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  const row = breakdownRow(page, modal, 'Bench Press')

  await expect(row.locator('[data-id="progress-exercise-sets"]')).toHaveText('3 sets')
  await expect(row.locator('[data-id="progress-exercise-reps"]')).toHaveText('15 reps')
  await expect(row.locator('[data-id="progress-exercise-volume"]')).toHaveText('2,025 vol')
  await expect(row.locator('[data-id="progress-exercise-max"]')).toHaveText('135 max lb')

  // The grand total is selectedBar.volume — the same number the bar's height is drawn
  // from — so 2,025 here and 2,025 in the row above is bar and breakdown agreeing.
  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('2,025')
})

// The tooltip is the only place the set count reaches the screen before a click, and it
// had no browser coverage at all before this test. The payload it renders is assembled
// in the chart module and carried through the server action into page state.
test('counted set line reports 3 sets in the chart tooltip', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135, count: 3 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })
  await page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first().hover()

  await expect(page.locator('[data-id="progress-tooltip"]')).toBeVisible()
  await expect(tooltipFigure(page, 'sets')).toHaveText('3 sets')
  await expect(tooltipFigure(page, 'reps')).toHaveText('15 reps')
  await expect(tooltipFigure(page, 'volume')).toHaveText('2,025')
})

// The tooltip is mounted over the bars, so it must not steal the hover contract the
// existing `modal does not open on hover` test protects: the panel appears, the
// breakdown does not.
test('hovering a bar shows the tooltip but still does not open the modal', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135, count: 3 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })
  await page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first().hover()

  await expect(page.locator('[data-id="progress-tooltip"]')).toBeVisible()
  await expect(page.locator('[id="progress-detail-modal"]')).not.toBeVisible()
})

// The companion of the hover case: the tooltip sits between the pointer and the bar and
// must not intercept the click that opens the breakdown.
test('clicking a bar still opens the modal with the tooltip mounted', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [{ id: 's1', reps: 5, weight: 135, count: 3 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-bar-chart"]')).toBeVisible({ timeout: 10000 })

  const bar = page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first()
  await bar.hover()
  await expect(page.locator('[data-id="progress-tooltip"]')).toBeVisible()

  await bar.click()

  const modal = page.locator('[id="progress-detail-modal"]')
  await expect(modal).toBeVisible({ timeout: 5000 })
  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('2,025')
})

// The no-migration guarantee: rows written before the count field existed must keep the
// figures they had. These are the numbers the pre-count suite asserted, restated on the
// hooks so a count-blind reader and a count-aware reader are forced to agree here.
test('legacy session with no count field renders today’s figures unchanged', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155 },
  ])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  const row = breakdownRow(page, modal, 'Bench Press')

  await expect(row.locator('[data-id="progress-exercise-sets"]')).toHaveText('2 sets')
  await expect(row.locator('[data-id="progress-exercise-reps"]')).toHaveText('8 reps')
  await expect(row.locator('[data-id="progress-exercise-volume"]')).toHaveText('1,140 vol')
  await expect(row.locator('[data-id="progress-exercise-max"]')).toHaveText('155 max lb')
  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('1,140')
})

// One session holding both shapes at once: the uncounted line must still read one set
// while the counted line reads two, in the same row.
test('mixed legacy and counted lines in one session', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]

  createWorkoutLog(exerciseId, daysAgo(10), [
    { id: 's1', reps: 5, weight: 135 },
    { id: 's2', reps: 3, weight: 155, count: 2 },
  ])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  const row = breakdownRow(page, modal, 'Bench Press')

  await expect(row.locator('[data-id="progress-exercise-sets"]')).toHaveText('3 sets')
  await expect(row.locator('[data-id="progress-exercise-reps"]')).toHaveText('11 reps')
  await expect(row.locator('[data-id="progress-exercise-volume"]')).toHaveText('1,605 vol')
  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('1,605')
})

// The count has to survive the aggregation hop, not just the read hop: two sessions
// folded into one month bar, both counts credited into one breakdown row.
test('month granularity credits set counts across sessions', async ({ page }) => {
  const exerciseId = createExercises(['Bench Press'])[0]
  const [firstDate, secondDate] = datesInOneMonth()

  createWorkoutLog(exerciseId, firstDate, [{ id: 's1', reps: 5, weight: 135, count: 3 }])
  createWorkoutLog(exerciseId, secondDate, [{ id: 's2', reps: 3, weight: 155, count: 2 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'month' }).click()
  await expect(page.getByText('VOLUME BY MONTH')).toBeVisible()

  await expect(page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle')).toHaveCount(1)

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  const row = breakdownRow(page, modal, 'Bench Press')

  await expect(row.locator('[data-id="progress-exercise-sets"]')).toHaveText('5 sets')
  await expect(row.locator('[data-id="progress-exercise-reps"]')).toHaveText('21 reps')
  await expect(row.locator('[data-id="progress-exercise-volume"]')).toHaveText('2,955 vol')
  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('2,955')
})

// The cross-layer contract in ALL mode: the grand total is the bar's own aggregate and
// the rows are the per-exercise aggregates, built on two different paths through the
// chart module. They must add up, or a bar disagrees with its own breakdown.
test('grand total equals the sum of the per-exercise breakdown volumes', async ({ page }) => {
  const ids = createExercises(['Bench Press', 'Squat'])

  const sessionDate = daysAgo(10)
  createWorkoutLog(ids[0], sessionDate, [{ id: 's1', reps: 5, weight: 135, count: 3 }])
  createWorkoutLog(ids[1], sessionDate, [{ id: 's2', reps: 5, weight: 100, count: 2 }])

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/progress`)
  await expect(page.getByRole('heading', { name: 'FORCE PROGRESSION' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('[id="progress-exercise-selector"] select option')).toHaveCount(3)

  await openBarModal(page)

  const modal = page.locator('[id="progress-detail-modal"]')
  const bench = breakdownRow(page, modal, 'Bench Press')
  const squat = breakdownRow(page, modal, 'Squat')

  await expect(bench.locator('[data-id="progress-exercise-volume"]')).toHaveText('2,025 vol')
  await expect(bench.locator('[data-id="progress-exercise-sets"]')).toHaveText('3 sets')
  await expect(squat.locator('[data-id="progress-exercise-volume"]')).toHaveText('1,000 vol')
  await expect(squat.locator('[data-id="progress-exercise-sets"]')).toHaveText('2 sets')

  await expect(modal.locator('[data-id="progress-total-volume"]')).toHaveText('3,025')
})

