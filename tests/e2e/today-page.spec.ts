import { test, expect } from '@playwright/test'

import { ensureSchema, openE2eDatabase, wipeE2eData } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

const BASE_URL = getE2eBaseUrl()

const db = openE2eDatabase()
ensureSchema(db, process.cwd())

function todayUTCDate(): string {
  return new Date().toISOString().split('T')[0]
}

function appDayIndex(): number {
  return (new Date().getDay() - 1 + 7) % 7
}

function seedExerciseScheduledToday(name: string): number {
  const exerciseId = Number(
    db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, 1)').run(name).lastInsertRowid,
  )
  db.prepare(
    'INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (1, ?, ?)',
  ).run(exerciseId, appDayIndex())
  return exerciseId
}

function readStoredSets(exerciseId: number): unknown {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = 1 AND exercise_id = ? AND date = ?')
    .get(exerciseId, todayUTCDate()) as { sets: unknown } | undefined

  if (row === undefined) return null

  let value = row.sets
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth += 1) {
    value = JSON.parse(value)
  }
  return value
}

function loggedSetsToday(exerciseId: number): { reps: number; weight: number }[] | null {
  const value = readStoredSets(exerciseId)
  if (value === null) return null

  if (!Array.isArray(value)) {
    throw new Error(
      `workout_logs.sets for exercise ${exerciseId} on ${todayUTCDate()} is not an array: ` +
        `typeof ${typeof value} / value ${JSON.stringify(value)}`,
    )
  }

  return (value as { reps: number; weight: number }[]).map((set) => ({
    reps: set.reps,
    weight: set.weight,
  }))
}

test.beforeEach(() => {
  ensureSchema(db, process.cwd())
  wipeE2eData(db)
  db.exec('DELETE FROM sqlite_sequence')
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
})

test('a typed set is persisted by the debounced save and comes back on the screen inside the configured window', async ({
  page,
}, testInfo) => {
  const exerciseId = seedExerciseScheduledToday('Debounce Probe')

  await loginAsBruno(page)
  await page.goto(`${BASE_URL}/today`)

  const card = page.locator(`[data-id="exercise-card-${exerciseId}"]`)
  await expect(card).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Debounce Probe' })).toBeVisible()

  const weightInput = card.getByLabel('Weight in pounds for Debounce Probe')
  const repsInput = card.getByLabel('Reps for Debounce Probe')
  const countInput = card.getByLabel('Set count for Debounce Probe')

  const startedAt = Date.now()
  await weightInput.fill('135')
  await repsInput.fill('5')
  await countInput.fill('1')

  await expect
    .poll(() => loggedSetsToday(exerciseId), {
      message: 'the debounced save never reached workout_logs for today',
    })
    .toEqual([{ reps: 5, weight: 135 }])

  const settledInMs = Date.now() - startedAt
  expect(settledInMs).toBeGreaterThan(0)
  expect(settledInMs).toBeLessThan(testInfo.timeout)

  await page.reload()

  await expect(card).toBeVisible()
  await expect(weightInput).toHaveValue('135')
  await expect(repsInput).toHaveValue('5')
})
