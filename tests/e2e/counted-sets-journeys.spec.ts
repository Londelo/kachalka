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

// Every journey below walks into a route the dev server this run started has never
// seen, and in `next dev` the first hit on a route compiles it inside the request
// that asked — a cold /progress pulls in 2271 modules, recharts among them. That
// compile is paid out of the test's own 15s budget (playwright.config.ts), so the
// drawer click lands, Next prints `○ Compiling /progress ...`, and `toHaveURL` at
// walkTo expires on /history while the route is still building. Nothing on screen is
// wrong; the budget simply never accounted for a compile.
//
// So the routes are compiled here, once, before any journey starts, and the budget
// stays what it is: it is the thing that makes a genuinely slow journey fail loudly,
// and inflating it globally would hide exactly the journeys this file exists to
// prove. A journey that still legitimately needs more than one window says so itself
// with test.setTimeout.
const ROUTES_TO_WARM = ['/today', '/history', '/progress', '/plan']

test.beforeAll(async ({ request }) => {
  // A hook inherits the test budget, and four first-time compiles do not fit in one
  // save window on a cold .next. This lifts the hook alone — test.setTimeout inside a
  // beforeAll moves the hook's timeout and leaves every journey below on the 15s it
  // was sized with, which is the number that makes a slow journey fail loudly.
  test.setTimeout(60_000)

  for (const route of ROUTES_TO_WARM) {
    const response = await request.get(`${BASE_URL}${route}`)
    // A warming step that quietly answered 500 would leave every journey downstream
    // to time out somewhere else, so the warm itself has to be proved.
    expect(response.status(), `warming GET ${route} must answer`).toBe(200)
  }
})

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

// ── the named line ────────────────────────────────────────────────────────────
//
// A card renders ONE error string for the whole exercise — `errors` is a
// Map<number, string> keyed by exerciseId and the string is painted at card level
// (src/app/today/page.tsx:595) — so on a card holding several lines the sentence
// alone can say what is wrong without saying where. Every journey above drives one
// refused line and reads that sentence, and none of them can tell "the line is
// named" from "no line is named": with a single line on the card, any true sentence
// names it by default. Five lines with the zero on the third is the shape that
// separates the two, and the message has to answer for the position the lifter
// counts with their own eyes — which is the DOM order of the rows, not an index
// some frame above the throw holds.
//
// All three fields answer to the same judge: `validateSet` throws for a zero
// weight, a zero rep count and a count below the minimum, each prefixed with
// `Line N: ` (src/features/workout/workout-entity.ts:48-66), and N is the
// position in the array the wire sent — `sets.forEach((set, index) =>
// validateSet(set, index + 1))` (src/features/workout/log-workout.ts:16) — which
// is the order the card lays its rows out in.
//
// The refused line here carries a zero WEIGHT. That is a choice, not a
// consequence: the weight zero is the one refusal with no second door standing in
// front of it, since `describeIncompleteDraftFields` only asks whether a field is
// null, so a parsed 0 sails through it and the domain's throw is the only refusal
// the lifter ever sees on this card. A count zero is refused by the same rule and
// is driven by its own journey at the bottom of this file.
//
// A typed count of `0` does reach that throw. It parses to the number 0
// (src/app/today/set-field.ts:20) and `isCollapsibleSetDraft`
// (src/app/today/set-draft.ts:51-56) then answers false for its row, so the row is
// never handed to the fold and never passes through `toCollapsedDraft`, which
// would have painted `getSetCount`'s clamped 1 over the digit before the save was
// ever armed. A row the rule cannot take also keeps its own position
// (src/app/today/collapse-drafts.ts:66-71), so the number in the sentence is still
// the row the lifter is looking at.
//
// The lines are typed top to bottom and no pair repeats. Nothing the fold does can
// move a row any more, but a repeated pair folds two lines into one, and the line
// the message numbers would then be no row on the screen at all.

const FIVE_LINES: RowValues[] = [
  { count: '2', weight: '135', reps: '5' },
  { count: '1', weight: '185', reps: '3' },
  { count: '3', weight: '0', reps: '8' },
  { count: '1', weight: '95', reps: '10' },
  { count: '4', weight: '225', reps: '6' },
]

const REFUSED_LINE = 3
const REFUSED_LINE_INDEX = REFUSED_LINE - 1
const REFUSED_LINE_FIX = '205'

// Rows are addressed by the draft id the shell keys them with, never by position:
// the row being typed into is the one the collapse moves, so `nth(index)` would be
// aimed at whichever row happened to be sitting at that index this render.
function rowDraftIdsInOrderOf(page: Page, exerciseId: number): Promise<string[]> {
  return rowIdsOf(page, exerciseId).evaluateAll(
    (elements, prefix) =>
      elements.map((element) => (element.getAttribute('data-id') ?? '').slice(prefix.length)),
    `set-count-${exerciseId}-`,
  )
}

function fieldOfRow(
  page: Page,
  exerciseId: number,
  field: 'count' | 'weight' | 'reps',
  draftId: string,
) {
  const dataId = { count: 'set-count', weight: 'set-weight', reps: 'set-reps' }[field]
  return page.locator(`[data-id="${dataId}-${exerciseId}-${draftId}"]`)
}

test('a zero on the third line of a five-line card is refused by name, and fixing that one line saves all five', async ({
  page,
}) => {
  // Two whole debounce windows are in this journey — the save the zero is refused
  // on, and the save the fix lands on — on top of fifteen fills and a walk to War
  // Logs. The suite default is one window's floor, so this lifts this journey only.
  test.setTimeout(60_000)

  const exerciseId = seedExerciseScheduledToday('Incline Press')
  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, 1)

  for (let line = 1; line < FIVE_LINES.length; line += 1) {
    await addButtonOf(page, exerciseId).click()
  }
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(FIVE_LINES.length)

  // Read before the first keystroke, while all five rows are blank and therefore
  // unmoved: this is the order the lifter sees and counts, and the ids are how every
  // field below is addressed.
  const draftIds = await rowDraftIdsInOrderOf(page, exerciseId)
  expect(draftIds, 'the card holds five lines').toHaveLength(FIVE_LINES.length)

  // SET, LB, REPS per line — the order the row lays them out, so the keystroke that
  // makes a line collapsible is the last one and no collapse rewrite lands on a
  // field mid-burst. One 5000ms window covers the whole fifteen-fill burst.
  for (const [index, values] of FIVE_LINES.entries()) {
    for (const field of ['count', 'weight', 'reps'] as const) {
      await fieldOfRow(page, exerciseId, field, draftIds[index]).fill(values[field])
    }
  }

  const error = errorOf(page, exerciseId)
  await expect(error).toBeVisible()
  await expect(error).toHaveText(
    `Line ${REFUSED_LINE}: Weight must be more than 0 — enter the weight you lifted, or remove the line.`,
  )

  // The zero reached the domain over the wire rather than being filtered out on the
  // way, and it was the third line of the array the domain walked — the number in
  // the message is a position in this list, so the list is part of the claim.
  const refusedSaves = savesFor(session, exerciseId)
  expect(
    refusedSaves.length,
    'more than one save went out while the card was still being typed into, so a ' +
      'save earlier than the refused one wrote lines to the day and the emptiness ' +
      'below is not this refusal\'s doing',
  ).toBe(1)
  expect(
    refusedSaves[0]?.sets,
    'the zero has to reach the domain and be refused there, not be filtered out on the way',
  ).toEqual([
    { weight: 135, reps: 5, count: 2 },
    { weight: 185, reps: 3, count: 1 },
    { weight: 0, reps: 8, count: 3 },
    { weight: 95, reps: 10, count: 1 },
    { weight: 225, reps: 6, count: 4 },
  ])

  // The number the message names is the row the lifter counts, top to bottom: the
  // third row on the card is the one still holding the zero, and the first is not.
  const domOrder = await rowDraftIdsInOrderOf(page, exerciseId)
  expect(
    domOrder,
    'the card no longer lays its five lines out in the order they were typed, so a ' +
      'line number read off the saved array is not a position on the screen',
  ).toEqual(draftIds)
  await expect(fieldOfRow(page, exerciseId, 'weight', domOrder[REFUSED_LINE_INDEX])).toHaveValue(
    '0',
  )
  await expect(fieldOfRow(page, exerciseId, 'weight', domOrder[0])).not.toHaveValue('0')

  expect(rowsFor(exerciseId, TODAY), 'the refusal wrote nothing partial').toHaveLength(0)

  // The recovery the message exists to make possible: one field, on the line it
  // named, with the other four lines never touched again.
  await fieldOfRow(page, exerciseId, 'weight', domOrder[REFUSED_LINE_INDEX]).fill(
    REFUSED_LINE_FIX,
  )

  const row = await awaitStoredSets(session, exerciseId, [
    { weight: 135, reps: 5, count: 2 },
    { weight: 185, reps: 3, count: 1 },
    { weight: 205, reps: 8, count: 3 },
    { weight: 95, reps: 10, count: 1 },
    { weight: 225, reps: 6, count: 4 },
  ])
  await expect(error).toHaveCount(0)

  // And the four lines the lifter never retyped arrived anyway: War Logs reads the
  // same eleven sets, seventy-one reps and 13,175 of volume the card is holding.
  await walkTo(page, 'HISTORY', '/history')
  const day = historyDay(page)
  await expect(day.locator(`[data-id="history-exercise-sets-${row.id}"]`)).toHaveText('11')
  await expect(day.locator(`[data-id="history-exercise-reps-${row.id}"]`)).toHaveText('71')
  await expect(day.locator('[data-id="history-total-sets"]')).toHaveText('11')
  await expect(day.locator('[data-id="history-total-reps"]')).toHaveText('71')
  await expect(day.locator('[data-id="history-total-volume"]')).toHaveText('13,175')
})

// ── the count box ───────────────────────────────────────────────────────────────
//
// The weight zero above and the rep zero further up are refused on screen; the
// count box is the third field and the only one whose road to `validateSet` moved.
// A `0` typed there used to be clamped to 1 by the fold before the save was armed,
// so the sentence below was unreachable from this input box no matter what the
// domain thought. No journey in this file typed one, so nothing in a browser
// proved the digit survives the keystroke, the collapse and the wire and comes
// back as the sentence on the card. The unit tier owns the rule itself; this owns
// the road.

const COUNT_TOO_SMALL =
  'Set count must be at least 1 — enter how many sets you did, or leave it blank for one.'

const COUNT_ZERO_LINES: RowValues[] = [
  { count: '2', weight: '135', reps: '5' },
  { count: '0', weight: '185', reps: '3' },
  { count: '1', weight: '95', reps: '10' },
]

const COUNT_ZERO_LINE = 2
const COUNT_ZERO_LINE_INDEX = COUNT_ZERO_LINE - 1
const COUNT_ZERO_FIX = '1'

test('a zero typed in the count box of the second line of a three-line card is refused by name, and fixing that one line saves all three', async ({
  page,
}) => {
  // Two whole debounce windows are in this journey — the save the zero is refused
  // on, and the save the fix lands on. The suite default is one window's floor.
  test.setTimeout(60_000)

  const exerciseId = seedExerciseScheduledToday('Barbell Row')
  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, 1)

  for (let line = 1; line < COUNT_ZERO_LINES.length; line += 1) {
    await addButtonOf(page, exerciseId).click()
  }
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(COUNT_ZERO_LINES.length)

  // Read before the first keystroke, while all three rows are blank: this is the
  // order the lifter sees and counts, and the ids are how every field below is
  // addressed.
  const draftIds = await rowDraftIdsInOrderOf(page, exerciseId)
  expect(draftIds, 'the card holds three lines').toHaveLength(COUNT_ZERO_LINES.length)

  // SET, LB, REPS per line, so the keystroke that would make a row collapsible is
  // the last one and no fold rewrite lands on a field mid-burst.
  for (const [index, values] of COUNT_ZERO_LINES.entries()) {
    for (const field of ['count', 'weight', 'reps'] as const) {
      await fieldOfRow(page, exerciseId, field, draftIds[index]).fill(values[field])
    }
  }

  const error = errorOf(page, exerciseId)
  await expect(error).toBeVisible()
  await expect(error).toHaveText(`Line ${COUNT_ZERO_LINE}: ${COUNT_TOO_SMALL}`)

  // The digit the lifter typed is the digit the domain judged: a fold that had
  // taken this row would have sent 1 and the sentence above would never have
  // fired, so this array is the difference between a refusal and a silent rewrite.
  const refusedSaves = savesFor(session, exerciseId)
  expect(
    refusedSaves.length,
    'more than one save went out while the card was still being typed into, so a ' +
      'save earlier than the refused one wrote lines to the day and the emptiness ' +
      'below is not this refusal\'s doing',
  ).toBe(1)
  expect(
    refusedSaves[0]?.sets,
    'the typed zero has to reach the domain and be refused there, not be clamped to ' +
      '1 by the fold on the way',
  ).toEqual([
    { weight: 135, reps: 5, count: 2 },
    { weight: 185, reps: 3, count: 0 },
    { weight: 95, reps: 10, count: 1 },
  ])

  // The number the message names is the row the lifter counts, top to bottom: the
  // second row on the card still holds the zero, and the first does not.
  const domOrder = await rowDraftIdsInOrderOf(page, exerciseId)
  expect(
    domOrder,
    'the card no longer lays its three lines out in the order they were typed, so a ' +
      'line number read off the saved array is not a position on the screen',
  ).toEqual(draftIds)
  await expect(
    fieldOfRow(page, exerciseId, 'count', domOrder[COUNT_ZERO_LINE_INDEX]),
  ).toHaveValue('0')
  await expect(fieldOfRow(page, exerciseId, 'count', domOrder[0])).not.toHaveValue('0')

  expect(rowsFor(exerciseId, TODAY), 'the refusal wrote nothing partial').toHaveLength(0)

  // The recovery the message exists to make possible: one field, on the line it
  // named, with the other two lines never touched again.
  await fieldOfRow(page, exerciseId, 'count', domOrder[COUNT_ZERO_LINE_INDEX]).fill(
    COUNT_ZERO_FIX,
  )

  await awaitStoredSets(session, exerciseId, [
    { weight: 135, reps: 5, count: 2 },
    { weight: 185, reps: 3, count: 1 },
    { weight: 95, reps: 10, count: 1 },
  ])
  await expect(error).toHaveCount(0)
})
