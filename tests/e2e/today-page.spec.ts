import { test, expect } from '@playwright/test'

import { ensureSchema, openE2eDatabase } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

const BASE_URL = getE2eBaseUrl()

const db = openE2eDatabase()
ensureSchema(db)

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

function loggedSetsToday(exerciseId: number): { reps: number; weight: number }[] | null {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = 1 AND exercise_id = ? AND date = ?')
    .get(exerciseId, todayUTCDate()) as { sets: string | { reps: number; weight: number }[] } | undefined

  if (row === undefined) return null

  const parsed: { reps: number; weight: number }[] =
    typeof row.sets === 'string' ? JSON.parse(row.sets) : row.sets
  return parsed.map((set) => ({ reps: set.reps, weight: set.weight }))
}

test.beforeEach(() => {
  ensureSchema(db)
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
  db.exec('DELETE FROM workout_logs WHERE user_id = 1')
  db.exec('DELETE FROM user_routines WHERE user_id = 1')
  db.exec('DELETE FROM exercises WHERE user_id = 1')
  db.exec(
    "DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')",
  )
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

  const weightInput = card.locator('input[type="number"]').first()
  const repsInput = card.locator('input[type="number"]').nth(1)

  const startedAt = Date.now()
  await weightInput.fill('135')
  await repsInput.fill('5')

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
