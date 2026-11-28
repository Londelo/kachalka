import { test, expect } from '@playwright/test'
import type { Page, Request, Response } from '@playwright/test'

import { jsDayToAppIndex, getTodayLocalDate } from '@/shared/utils/date'

import { ensureSchema, openE2eDatabase, wipeE2eData } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

const BASE_URL = getE2eBaseUrl()
const BRUNO_USER_ID = 1

const db = openE2eDatabase()
ensureSchema(db, process.cwd())

interface StoredSet {
  weight: number
  reps: number
  count: number | null
}

interface StoredRow {
  id: number
  date: string
  sets: StoredSet[]
}

function dateInZone(timeZone: string, instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const read = (kind: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === kind)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

function appDayIndexInZone(timeZone: string, instant: Date = new Date()): number {
  const [year, month, day] = dateInZone(timeZone, instant).split('-').map(Number)
  return jsDayToAppIndex(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
}

const MACHINE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const TODAY = dateInZone(MACHINE_ZONE)
const TODAY_INDEX = appDayIndexInZone(MACHINE_ZONE)

// One calendar day drives every claim below: the day the page stamps a save, the
// day the pre-fill reads back on, the day seeded rows are written on, and the day
// section War Logs must open. It is spelled here off Intl rather than off the
// app's own formatter so the agreement is an assertion and not a tautology.
if (getTodayLocalDate() !== TODAY) {
  throw new Error(
    `The app's getTodayLocalDate() (${getTodayLocalDate()}) disagrees with this ` +
      `machine's local calendar day (${TODAY}) in ${MACHINE_ZONE}; every journey ` +
      `below would be asserting a date no screen can show.`,
  )
}

function parseStoredSets(raw: unknown): StoredSet[] {
  let value = raw
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth += 1) {
    value = JSON.parse(value)
  }

  if (!Array.isArray(value)) {
    throw new Error(`workout_logs.sets is not an array: ${JSON.stringify(raw)}`)
  }

  return (value as Record<string, unknown>[]).map((line) => ({
    weight: Number(line.weight),
    reps: Number(line.reps),
    count: line.count === undefined || line.count === null ? null : Number(line.count),
  }))
}

function rowsFor(exerciseId: number, date: string): StoredRow[] {
  const rows = db
    .prepare(
      'SELECT id, date, sets FROM workout_logs WHERE user_id = ? AND exercise_id = ? AND date = ?',
    )
    .all(BRUNO_USER_ID, exerciseId, date) as { id: number; date: string; sets: unknown }[]

  return rows.map((row) => ({ id: Number(row.id), date: row.date, sets: parseStoredSets(row.sets) }))
}

function storedSets(exerciseId: number, date: string): StoredSet[] | null {
  const rows = rowsFor(exerciseId, date)
  return rows.length === 0 ? null : rows[0].sets
}

function storedColumn(exerciseId: number, date: string): string | null {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = ? AND exercise_id = ? AND date = ?')
    .get(BRUNO_USER_ID, exerciseId, date) as { sets: unknown } | undefined
  return row === undefined ? null : String(row.sets)
}

function seedExerciseScheduledToday(name: string): number {
  const exerciseId = Number(
    db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run(name, BRUNO_USER_ID)
      .lastInsertRowid,
  )
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(
    BRUNO_USER_ID,
    exerciseId,
    TODAY_INDEX,
  )
  return exerciseId
}

type SeededLine = { id: string; weight: number; reps: number; count?: number }

// 'production' stores the column the way repo create()/update() do — stringified
// once by hand and again by Drizzle's json mode. 'legacy' is the single-encoded,
// count-less shape rows written before the count field existed hold.
function seedSavedLog(
  exerciseId: number,
  date: string,
  sets: SeededLine[],
  storage: 'production' | 'legacy' = 'production',
): void {
  const json = storage === 'production' ? JSON.stringify(JSON.stringify(sets)) : JSON.stringify(sets)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(BRUNO_USER_ID, exerciseId, date, json, now, now)
}

function cardOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function errorOf(page: Page, exerciseId: number) {
  return cardOf(page, exerciseId).locator(`[data-id="card-error-${exerciseId}"]`)
}

function rowIdsOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id^="set-count-${exerciseId}-"]`)
}

function inputOf(
  page: Page,
  exerciseId: number,
  name: string,
  field: 'count' | 'weight' | 'reps',
  index = 0,
) {
  const label = {
    count: `Set count for ${name}`,
    weight: `Weight in pounds for ${name}`,
    reps: `Reps for ${name}`,
  }[field]

  return cardOf(page, exerciseId).getByLabel(label, { exact: true }).nth(index)
}

function addButtonOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="add-set-${exerciseId}"]`)
}

function pastRowOf(page: Page, exerciseId: number, weight: number, reps: number) {
  return page.locator(`[data-id="past-session-line-${exerciseId}-${weight}-${reps}"]`)
}

function toggleViewOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="toggle-view-${exerciseId}"]`)
}

async function openDrawer(page: Page): Promise<void> {
  await page.locator('#header-nav-btn').click()
}

function drawerTab(page: Page, label: string) {
  return page.getByRole('link', { name: label })
}

interface SentSave {
  exerciseId: number
  date: string
  sets: StoredSet[]
}

interface TodaySession {
  page: Page
  saves: SentSave[]
  prefillResponses: Response[]
}

function actionArgsOf(request: Request): unknown[] | null {
  if (request.method() !== 'POST') return null

  const body = request.postData()
  if (body === null) return null

  try {
    const args: unknown = JSON.parse(body)
    return Array.isArray(args) ? args : null
  } catch {
    return null
  }
}

function isWorkoutsPrefill(request: Request): boolean {
  const args = actionArgsOf(request)
  return args !== null && args.length === 1 && args[0] === BRUNO_USER_ID
}

function saveOf(request: Request): SentSave | null {
  const args = actionArgsOf(request)
  if (args === null || args.length !== 4) return null

  const [userId, exerciseId, date, sets] = args
  if (userId !== BRUNO_USER_ID) return null
  if (typeof exerciseId !== 'number' || typeof date !== 'string' || !Array.isArray(sets)) {
    return null
  }

  return {
    exerciseId,
    date,
    sets: (sets as Record<string, unknown>[]).map((line) => ({
      weight: Number(line.weight),
      reps: Number(line.reps),
      count: line.count === undefined || line.count === null ? null : Number(line.count),
    })),
  }
}

async function signInAsBruno(page: Page, path = '/today'): Promise<TodaySession> {
  await loginAsBruno(page)

  const cookies = await page.context().cookies(BASE_URL)
  expect(
    cookies.some((cookie) => cookie.name === 'kachalka.userId' && cookie.value === '1'),
    'loginAsBruno must set kachalka.userId=1 before any save is relied upon',
  ).toBe(true)

  const session: TodaySession = { page, saves: [], prefillResponses: [] }

  page.on('request', (request) => {
    const save = saveOf(request)
    if (save !== null) session.saves.push(save)
  })
  page.on('response', (response) => {
    if (isWorkoutsPrefill(response.request())) session.prefillResponses.push(response)
  })

  await page.goto(`${BASE_URL}${path}`)

  return session
}

function drainPageMainThread(page: Page): Promise<unknown> {
  return page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(() => setTimeout(resolve, 0), 0)),
  )
}

async function awaitMountPrefill(session: TodaySession): Promise<void> {
  await expect
    .poll(() => session.prefillResponses.length, {
      message:
        'getTodayWorkoutsAction never answered, so the draft replacement in its ' +
        'continuation is still unapplied and a keystroke typed now is discarded',
    })
    .toBeGreaterThan(0)

  expect(session.prefillResponses[0]?.status(), 'getTodayWorkoutsAction must answer').toBe(200)

  await drainPageMainThread(session.page)
}

async function awaitQuietCard(
  session: TodaySession,
  exerciseId: number,
  rowCount: number,
): Promise<void> {
  const { page } = session
  await expect(cardOf(page, exerciseId)).toBeVisible()
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(rowCount)
  await expect(cardOf(page, exerciseId).getByText('SAVING...', { exact: true })).toHaveCount(0)
}

type RowValues = { count: string; weight: string; reps: string }

async function typeSet(
  session: TodaySession,
  exerciseId: number,
  name: string,
  values: RowValues,
  index = 0,
): Promise<void> {
  const { page } = session

  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, index + 1)

  for (const field of ['count', 'weight', 'reps'] as const) {
    await inputOf(page, exerciseId, name, field, index).fill(values[field])
  }
}

async function expectRowValues(
  page: Page,
  exerciseId: number,
  name: string,
  values: RowValues,
  index = 0,
): Promise<void> {
  for (const field of ['count', 'weight', 'reps'] as const) {
    await expect(inputOf(page, exerciseId, name, field, index)).toHaveValue(values[field])
  }
}

function savesFor(session: TodaySession, exerciseId: number): SentSave[] {
  return session.saves.filter((save) => save.exerciseId === exerciseId)
}

async function awaitStoredSets(
  session: TodaySession,
  exerciseId: number,
  expected: StoredSet[],
): Promise<StoredRow> {
  await expect
    .poll(() => storedSets(exerciseId, TODAY), {
      message: `the save never reached workout_logs for exercise ${exerciseId} on ${TODAY}`,
    })
    .toEqual(expected)

  const last = savesFor(session, exerciseId).at(-1)
  expect(
    last,
    `no logWorkoutAction was ever sent for exercise ${exerciseId}, so the row in ` +
      `workout_logs for it on ${TODAY} was not written by this journey`,
  ).toBeDefined()
  expect(last?.date, 'the save went to the day the page stamps').toBe(TODAY)
  expect(last?.sets).toEqual(expected)

  const rows = rowsFor(exerciseId, TODAY)
  expect(rows, 'exactly one row per exercise per day').toHaveLength(1)
  return rows[0]
}

async function walkTo(page: Page, label: string, path: string): Promise<void> {
  await openDrawer(page)
  await drawerTab(page, label).click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}

function historyDay(page: Page) {
  return page.locator(`#history-date-${TODAY}`)
}

async function openHistoryModal(page: Page, logId: number): Promise<ReturnType<Page['locator']>> {
  await page.locator(`#history-exercise-btn-${logId}`).click()
  const modal = page.locator('#history-set-detail-modal')
  await expect(modal).toBeVisible()
  return modal
}

function progressBreakdownRow(page: Page, modal: ReturnType<Page['locator']>, name: string) {
  return modal
    .locator('[data-id="progress-exercise-row"]')
    .filter({
      has: page.locator('[data-id="progress-exercise-name"]', { hasText: new RegExp(`^${name}$`) }),
    })
}

async function openProgressFor(page: Page, exerciseName: string) {
  await expect(page.locator('#progress-page')).toBeVisible()
  await page.locator('#progress-exercise-selector select').selectOption({ label: exerciseName })
  const bar = page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first()
  await expect(bar).toBeVisible()
  return bar
}

test.beforeEach(() => {
  ensureSchema(db, process.cwd())
  wipeE2eData(db)
  db.exec('DELETE FROM sqlite_sequence')
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (?, ?, ?)').run(
    BRUNO_USER_ID,
    'Bruno',
    1,
  )
})

test('a count typed once on Today reads the same number in the past view, the War Logs day, and the Force Progression bar', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Back Squat')
  const session = await signInAsBruno(page)

  await typeSet(session, exerciseId, 'Back Squat', { count: '4', weight: '185', reps: '6' })
  await addButtonOf(page, exerciseId).click()
  await typeSet(session, exerciseId, 'Back Squat', { count: '2', weight: '95', reps: '8' }, 1)

  const row = await awaitStoredSets(session, exerciseId, [
    { weight: 185, reps: 6, count: 4 },
    { weight: 95, reps: 8, count: 2 },
  ])

  await expectRowValues(page, exerciseId, 'Back Squat', { count: '4', weight: '185', reps: '6' })
  await expectRowValues(page, exerciseId, 'Back Squat', { count: '2', weight: '95', reps: '8' }, 1)

  await toggleViewOf(page, exerciseId).click()
  await expect(pastRowOf(page, exerciseId, 185, 6)).toHaveAttribute(
    'aria-label',
    '4 sets at 185 pounds for 6 reps',
  )
  await expect(pastRowOf(page, exerciseId, 95, 8)).toHaveAttribute(
    'aria-label',
    '2 sets at 95 pounds for 8 reps',
  )

  session.prefillResponses.length = 0
  await page.reload()
  await awaitMountPrefill(session)

  expect(page.url(), 'the session survives a reload').toMatch(/\/today$/)
  await expectRowValues(page, exerciseId, 'Back Squat', { count: '4', weight: '185', reps: '6' })
  await expectRowValues(page, exerciseId, 'Back Squat', { count: '2', weight: '95', reps: '8' }, 1)

  await walkTo(page, 'HISTORY', '/history')
  const day = historyDay(page)
  await expect(day, 'War Logs opens the very day the page stamped').toBeVisible()
  await expect(day.locator(`[data-id="history-exercise-sets-${row.id}"]`)).toHaveText('6')
  await expect(day.locator(`[data-id="history-exercise-reps-${row.id}"]`)).toHaveText('40')
  await expect(day.locator(`[data-id="history-exercise-max-weight-${row.id}"]`)).toHaveText('185')
  await expect(day.locator('[data-id="history-total-sets"]')).toHaveText('6')
  await expect(day.locator('[data-id="history-total-reps"]')).toHaveText('40')
  await expect(day.locator('[data-id="history-total-volume"]')).toHaveText('5,960')

  const modal = await openHistoryModal(page, row.id)
  await expect(modal.locator('[data-id="history-modal-set-row-0"]')).toBeVisible()
  await expect(modal.locator('[data-id="history-modal-set-row-1"]')).toBeVisible()
  await expect(modal.locator('[data-id="history-modal-set-count-0"]')).toContainText('4')
  await expect(modal.locator('[data-id="history-modal-set-count-1"]')).toContainText('2')
  await expect(modal.locator('[data-id="history-modal-sets"]')).toHaveText('6')
  await modal.getByRole('button', { name: 'CLOSE' }).click()
  await expect(modal).toHaveCount(0)

  await walkTo(page, 'PROGRESS', '/progress')
  const bar = await openProgressFor(page, 'Back Squat')

  await bar.hover()
  await expect(page.locator('[data-id="progress-tooltip"]')).toBeVisible()
  await expect(page.locator('[data-id="progress-tooltip-sets"]')).toHaveText('6 sets')
  await expect(page.locator('[data-id="progress-tooltip-reps"]')).toHaveText('40 reps')
  await expect(page.locator('[data-id="progress-tooltip-volume"]')).toHaveText('5,960')

  await bar.click()
  const chartModal = page.locator('#progress-detail-modal')
  await expect(chartModal).toBeVisible()
  const breakdown = progressBreakdownRow(page, chartModal, 'Back Squat')
  await expect(breakdown.locator('[data-id="progress-exercise-sets"]')).toHaveText('6 sets')
  await expect(breakdown.locator('[data-id="progress-exercise-reps"]')).toHaveText('40 reps')
  await expect(breakdown.locator('[data-id="progress-exercise-volume"]')).toHaveText('5,960 vol')
  await expect(breakdown.locator('[data-id="progress-exercise-max"]')).toHaveText('185 max lb')
  await expect(chartModal.locator('[data-id="progress-total-volume"]')).toHaveText('5,960')
})

test('a row stored before set counts existed reads as one set on every screen and is never rewritten', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Deadlift')
  seedSavedLog(
    exerciseId,
    TODAY,
    [
      { id: 'l1', weight: 225, reps: 3 },
      { id: 'l2', weight: 135, reps: 10 },
    ],
    'legacy',
  )
  const [seededRow] = rowsFor(exerciseId, TODAY)

  await signInAsBruno(page)
  await expect(cardOf(page, exerciseId)).toBeVisible()

  await toggleViewOf(page, exerciseId).click()
  await expect(pastRowOf(page, exerciseId, 225, 3)).toHaveAttribute(
    'aria-label',
    '1 set at 225 pounds for 3 reps',
  )
  await expect(pastRowOf(page, exerciseId, 135, 10)).toHaveAttribute(
    'aria-label',
    '1 set at 135 pounds for 10 reps',
  )

  await walkTo(page, 'HISTORY', '/history')
  const day = historyDay(page)
  await expect(day.locator(`[data-id="history-exercise-sets-${seededRow.id}"]`)).toHaveText('2')
  await expect(day.locator(`[data-id="history-exercise-reps-${seededRow.id}"]`)).toHaveText('13')
  await expect(day.locator('[data-id="history-total-sets"]')).toHaveText('2')
  await expect(day.locator('[data-id="history-total-reps"]')).toHaveText('13')
  await expect(day.locator('[data-id="history-total-volume"]')).toHaveText('2,025')

  const modal = await openHistoryModal(page, seededRow.id)
  await expect(modal.locator('[data-id="history-modal-set-count-0"]')).toContainText('1')
  await expect(modal.locator('[data-id="history-modal-set-count-1"]')).toContainText('1')
  await expect(modal.locator('[data-id="history-modal-sets"]')).toHaveText('2')
  await modal.getByRole('button', { name: 'CLOSE' }).click()

  await walkTo(page, 'PROGRESS', '/progress')
  await openProgressFor(page, 'Deadlift')
  const chartModal = page.locator('#progress-detail-modal')
  await page.locator('[id="progress-bar-chart"] .recharts-bar-rectangle').first().click()
  await expect(chartModal).toBeVisible()
  const breakdown = progressBreakdownRow(page, chartModal, 'Deadlift')
  await expect(breakdown.locator('[data-id="progress-exercise-sets"]')).toHaveText('2 sets')
  await expect(breakdown.locator('[data-id="progress-exercise-reps"]')).toHaveText('13 reps')
  await expect(breakdown.locator('[data-id="progress-exercise-volume"]')).toHaveText('2,025 vol')
  await expect(breakdown.locator('[data-id="progress-exercise-max"]')).toHaveText('225 max lb')

  const column = storedColumn(exerciseId, TODAY)
  expect(column, 'the row is still there after the whole walk').not.toBeNull()
  expect(column, 'no reader stamped a count onto a legacy line').not.toMatch(/count/i)
})

test('a fractional set count floors to the same whole number on every screen', async ({ page }) => {
  const exerciseId = seedExerciseScheduledToday('Overhead Press')
  const session = await signInAsBruno(page)

  await typeSet(session, exerciseId, 'Overhead Press', { count: '2.7', weight: '135', reps: '5' })
  await addButtonOf(page, exerciseId).click()
  await typeSet(session, exerciseId, 'Overhead Press', { count: '1.5', weight: '95', reps: '8' }, 1)

  // Each line is floored on its own: a reader that summed the fractions and
  // floored once at the end would call this day 4 sets and 2,775 of volume.
  const row = await awaitStoredSets(session, exerciseId, [
    { weight: 135, reps: 5, count: 2 },
    { weight: 95, reps: 8, count: 1 },
  ])

  await toggleViewOf(page, exerciseId).click()
  await expect(pastRowOf(page, exerciseId, 135, 5)).toHaveAttribute(
    'aria-label',
    '2 sets at 135 pounds for 5 reps',
  )
  await expect(pastRowOf(page, exerciseId, 95, 8)).toHaveAttribute(
    'aria-label',
    '1 set at 95 pounds for 8 reps',
  )

  await walkTo(page, 'HISTORY', '/history')
  const day = historyDay(page)
  await expect(day.locator(`[data-id="history-exercise-sets-${row.id}"]`)).toHaveText('3')
  await expect(day.locator(`[data-id="history-exercise-reps-${row.id}"]`)).toHaveText('18')
  await expect(day.locator('[data-id="history-total-sets"]')).toHaveText('3')
  await expect(day.locator('[data-id="history-total-reps"]')).toHaveText('18')
  await expect(day.locator('[data-id="history-total-volume"]')).toHaveText('2,110')

  const modal = await openHistoryModal(page, row.id)
  await expect(modal.locator('[data-id="history-modal-set-count-0"]')).toContainText('2')
  await expect(modal.locator('[data-id="history-modal-set-count-1"]')).toContainText('1')
  await modal.getByRole('button', { name: 'CLOSE' }).click()

  await walkTo(page, 'PROGRESS', '/progress')
  const bar = await openProgressFor(page, 'Overhead Press')
  await bar.hover()
  await expect(page.locator('[data-id="progress-tooltip-sets"]')).toHaveText('3 sets')
  await expect(page.locator('[data-id="progress-tooltip-volume"]')).toHaveText('2,110')

  await bar.click()
  const chartModal = page.locator('#progress-detail-modal')
  await expect(chartModal).toBeVisible()
  const breakdown = progressBreakdownRow(page, chartModal, 'Overhead Press')
  await expect(breakdown.locator('[data-id="progress-exercise-sets"]')).toHaveText('3 sets')
  await expect(breakdown.locator('[data-id="progress-exercise-reps"]')).toHaveText('18 reps')
  await expect(breakdown.locator('[data-id="progress-exercise-volume"]')).toHaveText('2,110 vol')
})

test('a refused line names itself on its card, leaves the saved line intact, and the fix reaches the War Logs', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedSavedLog(exerciseId, TODAY, [{ id: 's1', weight: 135, reps: 5, count: 3 }])

  const session = await signInAsBruno(page)

  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, 1)
  await expectRowValues(page, exerciseId, 'Bench Press', { count: '3', weight: '135', reps: '5' })

  await addButtonOf(page, exerciseId).click()
  await typeSet(session, exerciseId, 'Bench Press', { count: '1', weight: '0', reps: '5' }, 1)

  const error = errorOf(page, exerciseId)
  await expect(error).toBeVisible()
  await expect(error).toContainText('Weight must be more than 0')

  const refused = savesFor(session, exerciseId).at(-1)
  expect(
    refused?.sets,
    'the zero has to reach the domain and be refused there, not be filtered out on the way',
  ).toEqual([
    { weight: 135, reps: 5, count: 3 },
    { weight: 0, reps: 5, count: 1 },
  ])

  expect(rowsFor(exerciseId, TODAY), 'the refusal wrote nothing partial').toEqual([
    {
      id: expect.any(Number),
      date: TODAY,
      sets: [{ weight: 135, reps: 5, count: 3 }],
    },
  ])

  await inputOf(page, exerciseId, 'Bench Press', 'weight', 1).fill('205')

  const row = await awaitStoredSets(session, exerciseId, [
    { weight: 135, reps: 5, count: 3 },
    { weight: 205, reps: 5, count: 1 },
  ])
  await expect(error).toHaveCount(0)

  await walkTo(page, 'HISTORY', '/history')
  const day = historyDay(page)
  await expect(day.locator(`[data-id="history-exercise-sets-${row.id}"]`)).toHaveText('4')
  await expect(day.locator(`[data-id="history-exercise-reps-${row.id}"]`)).toHaveText('20')
  await expect(day.locator('[data-id="history-total-sets"]')).toHaveText('4')
  await expect(day.locator('[data-id="history-total-reps"]')).toHaveText('20')
  await expect(day.locator('[data-id="history-total-volume"]')).toHaveText('3,050')
})
