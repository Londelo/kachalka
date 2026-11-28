import { test, expect, type Page } from '@playwright/test'

import { formatDate, getTodayLocalDate, jsDayToAppIndex } from '@/shared/utils/date'

import { ensureSchema, openE2eDatabase } from '../harness/e2e-database'
import { getE2eBaseUrl } from './e2e-config'
import { loginAsBruno } from './helpers'

// The composition suite for the Today page's PAST SESSION region.
//
// What is proved here is the wiring, one pass per behaviour the region exposes:
// a figure written into workout_logs.sets reaches the rendered SET cell intact,
// the collapsed rows reach the page in seeded order, both empty states fire,
// the region arms no save, and the past and current views agree on one stored
// row. The branch matrix of buildPastSessionLines lives in
// tests/unit/app/today/past-session-lines.spec.ts and the collapse arithmetic
// in the counted-set domain's own specs; neither is restated below.

const BASE_URL = getE2eBaseUrl()
const BRUNO_USER_ID = 1

const db = openE2eDatabase()
ensureSchema(db, process.cwd())

type StoredLine = { id: string; weight: number; reps: number; count?: number }

interface RenderedRow {
  dataId: string
  set: string | null
  lb: string | null
  reps: string | null
}

interface TodaySession {
  page: Page
  saves: number[]
}

// ── clocks ────────────────────────────────────────────────────────────────────
//
// Three clocks meet on this page and the seed has to answer each of them with
// the helper the app itself uses. The card list is selected by the BROWSER's
// local weekday (today/page.tsx:321 jsDayToAppIndex(new Date().getDay())), so
// user_routines.day_of_week is seeded off that same local clock. The current
// session's pre-fill reads on the SERVER's local calendar day
// (workout-server-actions.ts getTodayWorkoutsAction -> getTodayLocalDate()), so
// the row meant to appear in BOTH views is dated with that helper. Everything
// else — a session that is purely in the past — is dated on the UTC clock the
// rest of the suite uses.

function appDayIndexToday(): number {
  return jsDayToAppIndex(new Date().getDay())
}

function daysBeforeToday(days: number): string {
  const day = new Date()
  day.setUTCDate(day.getUTCDate() - days)
  return formatDate(day)
}

// ── database doors ────────────────────────────────────────────────────────────

function seedExerciseScheduledToday(name: string): number {
  const exerciseId = Number(
    db
      .prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
      .run(name, BRUNO_USER_ID).lastInsertRowid,
  )

  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(
    BRUNO_USER_ID,
    exerciseId,
    appDayIndexToday(),
  )

  return exerciseId
}

// The column is DOUBLE-encoded exactly the way the write path leaves it:
// repo create()/update() JSON.stringify the array before Drizzle's
// text('sets', { mode: 'json' }) stringifies it a second time, and the read door
// (workout-repo-impl.ts mapRowToWorkoutLog) parses it back exactly once. A row
// written single-encoded here would still read — the door has a branch for it —
// and the suite would go green while testing a shape the app never stores.
function assertDoubleEncoded(stored: string, lines: StoredLine[]): void {
  const once = JSON.parse(stored) as unknown

  if (typeof once !== 'string') {
    throw new Error(
      `seedPreviousSession wrote a SINGLE-encoded sets column (${JSON.stringify(stored)}). The write ` +
        `path stores it double-encoded, and the read door has a branch for each shape — a single-encoded ` +
        `seed therefore reads fine and the suite goes green while proving nothing about real rows. ` +
        `Seeded lines: ${JSON.stringify(lines)}`,
    )
  }

  if (JSON.stringify(JSON.parse(once)) !== JSON.stringify(lines)) {
    throw new Error(
      `seedPreviousSession's double-encoded column does not read back as the seeded lines: ` +
        `${once} vs ${JSON.stringify(lines)}`,
    )
  }
}

function seedPreviousSession(exerciseId: number, date: string, lines: StoredLine[]): void {
  const now = Math.floor(Date.now() / 1000)
  const stored = JSON.stringify(JSON.stringify(lines))
  assertDoubleEncoded(stored, lines)

  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(BRUNO_USER_ID, exerciseId, date, stored, now, now)
}

function cleanupBruno(): void {
  db.exec('DELETE FROM workout_logs WHERE user_id = 1')
  db.exec('DELETE FROM user_routines WHERE user_id = 1')
  db.exec('DELETE FROM exercises WHERE user_id = 1')
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
}

// ── the page ──────────────────────────────────────────────────────────────────

function cardOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function toggleOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="toggle-view-${exerciseId}"]`)
}

function rowsRegionOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="past-session-rows-${exerciseId}"]`)
}

function emptyStateOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="past-session-empty-${exerciseId}"]`)
}

function lineOf(page: Page, exerciseId: number, weight: number, reps: number) {
  return page.locator(`[data-id="past-session-line-${exerciseId}-${weight}-${reps}"]`)
}

function rowsOf(page: Page, exerciseId: number) {
  return rowsRegionOf(page, exerciseId).locator('[role="listitem"]')
}

// The three figures of a row, each read out of the cell whose own label names
// it — never by ordinal position, so a reordered cell is caught rather than
// silently re-labelled.
function readRows(page: Page, exerciseId: number): Promise<RenderedRow[]> {
  return rowsOf(page, exerciseId).evaluateAll((elements) =>
    elements.map((element) => {
      const cells = Array.from(element.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      )

      const figureOf = (label: string): string | null => {
        const cell = cells.find((candidate) => candidate.firstElementChild?.textContent?.trim() === label)
        return cell?.lastElementChild?.textContent?.trim() ?? null
      }

      return {
        dataId: element.getAttribute('data-id') ?? '',
        set: figureOf('SET:'),
        lb: figureOf('LB:'),
        reps: figureOf('REPS:'),
      }
    }),
  )
}

// Both server actions POST to /today and their Next-Action ids are per-build
// hashes, so the argument list is the only stable way to tell them apart:
// getTodayWorkoutsAction takes (userId) alone, logWorkoutAction takes
// (userId, exerciseId, date, sets).
function postedArgs(request: { method: () => string; postData: () => string | null }): unknown[] | null {
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

function isPrefillRequest(request: { method: () => string; postData: () => string | null }): boolean {
  const args = postedArgs(request)
  return args !== null && args.length === 1 && args[0] === BRUNO_USER_ID
}

function isSaveRequest(request: { method: () => string; postData: () => string | null }): boolean {
  const args = postedArgs(request)
  return args !== null && args.length === 4 && args[0] === BRUNO_USER_ID
}

// The mount effect's pre-fill continuation calls setViewModes with every card
// pinned to 'current'. A toggle clicked before that response lands is therefore
// overwritten and the past view vanishes under the assertion — so every case
// below waits for the pre-fill to answer before it touches the toggle.
function drainPageMainThread(page: Page): Promise<unknown> {
  return page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(() => setTimeout(resolve, 0), 0)),
  )
}

async function signInAsBruno(page: Page): Promise<TodaySession> {
  await loginAsBruno(page)

  const saves: number[] = []
  const prefillAnswered = page
    .waitForResponse((response) => isPrefillRequest(response.request()), { timeout: 30_000 })
    .catch(() => null)

  page.on('request', (request) => {
    if (isSaveRequest(request)) saves.push(Date.now())
  })

  await page.goto(`${BASE_URL}/today`, { timeout: 60_000 })

  const response = await prefillAnswered
  expect(response, 'the mount pre-fill never answered, so a toggle now would be overwritten').not.toBeNull()
  expect(response?.status()).toBe(200)

  await drainPageMainThread(page)

  return { page, saves }
}

async function openPastView(session: TodaySession, exerciseId: number): Promise<void> {
  const { page } = session
  await expect(cardOf(page, exerciseId)).toBeVisible()
  await expect(toggleOf(page, exerciseId)).toHaveText('PAST SESSION')
  await toggleOf(page, exerciseId).click()
}

async function closePastView(session: TodaySession, exerciseId: number): Promise<void> {
  const { page } = session
  await expect(toggleOf(page, exerciseId)).toHaveText('CURRENT SESSION')
  await toggleOf(page, exerciseId).click()
}

test.beforeEach(() => {
  ensureSchema(db, process.cwd())
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (1, ?, ?)').run('Bruno', 1)
  cleanupBruno()
})

test.afterEach(() => {
  cleanupBruno()
})

// ── 1. the stored count survives every hop to the SET cell ─────────────────────

test('a stored line carrying count 3 renders one row reading SET 03 / LB 135 / REPS 5', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'bench-135x5', weight: 135, reps: 5, count: 3 },
  ])

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)

  await expect(rowsRegionOf(page, exerciseId)).toBeVisible()
  await expect(rowsOf(page, exerciseId)).toHaveCount(1)

  const [row] = await readRows(page, exerciseId)
  expect(row).toEqual({
    dataId: `past-session-line-${exerciseId}-135-5`,
    set: '03',
    lb: '135',
    reps: '5',
  })

  const figures = await readRows(page, exerciseId)
  expect(figures.map((rendered) => rendered.set), 'no row may wear a positional 01').not.toContain('01')
})

// ── 2. distinct lines keep their own counts and their order ────────────────────

test('two distinct stored lines render two rows in seeded order, each with its own count', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'heavy', weight: 135, reps: 5, count: 3 },
    { id: 'light', weight: 225, reps: 3, count: 2 },
  ])

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)

  await expect(rowsOf(page, exerciseId)).toHaveCount(2)

  const rows = await readRows(page, exerciseId)
  expect(rows.map((row) => row.dataId)).toEqual([
    `past-session-line-${exerciseId}-135-5`,
    `past-session-line-${exerciseId}-225-3`,
  ])
  expect(rows[0]).toMatchObject({ set: '03', lb: '135', reps: '5' })
  expect(rows[1]).toMatchObject({ set: '02', lb: '225', reps: '3' })
})

// ── 3. a pre-count stored row still reads as one set ───────────────────────────

test('a stored row whose lines carry no count field renders SET 01 per distinct line', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'legacy-a', weight: 135, reps: 5 },
    { id: 'legacy-b', weight: 225, reps: 3 },
  ])

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)

  await expect(rowsOf(page, exerciseId)).toHaveCount(2)

  const rows = await readRows(page, exerciseId)
  expect(rows.map((row) => row.set)).toEqual(['01', '01'])
  expect(rows.map((row) => row.lb)).toEqual(['135', '225'])
  expect(rows.map((row) => row.reps)).toEqual(['5', '3'])
})

// ── 4. an all-blank previous session is the empty state ────────────────────────

test('a previous session of nothing but blank lines shows NO PREVIOUS SESSIONS, not an empty table', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'blank-a', weight: 0, reps: 0, count: 1 },
    { id: 'blank-b', weight: 0, reps: 0 },
  ])

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)

  await expect(emptyStateOf(page, exerciseId)).toBeVisible()
  await expect(emptyStateOf(page, exerciseId).getByText('NO PREVIOUS SESSIONS', { exact: true })).toBeVisible()
  await expect(rowsRegionOf(page, exerciseId)).toHaveCount(0)
})

// ── 5. no previous session at all is the empty state ───────────────────────────

test('an exercise with no stored log shows NO PREVIOUS SESSIONS and leaves no loading state behind', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)

  await expect(emptyStateOf(page, exerciseId)).toBeVisible()
  await expect(emptyStateOf(page, exerciseId).getByText('NO PREVIOUS SESSIONS', { exact: true })).toBeVisible()
  await expect(rowsRegionOf(page, exerciseId)).toHaveCount(0)

  await expect(page.getByText(/^loading\.\.\.$/i)).toHaveCount(0)
})

// ── 6. the region is strictly read-only ────────────────────────────────────────

test('the past region holds no control, and clicking a row changes nothing and arms no save', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'bench-135x5', weight: 135, reps: 5, count: 3 },
    { id: 'bench-225x3', weight: 225, reps: 3, count: 2 },
  ])

  const session = await signInAsBruno(page)
  await openPastView(session, exerciseId)
  await expect(rowsOf(page, exerciseId)).toHaveCount(2)

  const region = rowsRegionOf(page, exerciseId)
  await expect(region.locator('button')).toHaveCount(0)
  await expect(region.locator('input')).toHaveCount(0)
  await expect(region.locator('a')).toHaveCount(0)
  await expect(region.locator('[role="button"]')).toHaveCount(0)

  const before = await readRows(page, exerciseId)
  await expect(cardOf(page, exerciseId).getByText('SAVING...', { exact: true })).toHaveCount(0)

  await lineOf(page, exerciseId, 135, 5).click()
  await drainPageMainThread(page)

  expect(await readRows(page, exerciseId)).toEqual(before)
  expect(session.saves, 'a click inside the read-only region must never arm a save').toHaveLength(0)
  await expect(cardOf(page, exerciseId).getByText('SAVING...', { exact: true })).toHaveCount(0)
})

// ── 7. past and current agree on the same stored data ──────────────────────────

test('the past view figures are the same figures the current view pre-fills from one stored row', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  // Dated on the SERVER's local day so the single stored row is read by BOTH
  // doors: findLatestForExercise feeds the past view, findByDate feeds the
  // current view's pre-fill.
  seedPreviousSession(exerciseId, getTodayLocalDate(), [
    { id: 'bench-135x5', weight: 135, reps: 5, count: 3 },
    { id: 'bench-225x3', weight: 225, reps: 3, count: 2 },
  ])

  const session = await signInAsBruno(page)
  const card = cardOf(page, exerciseId)
  await expect(card).toBeVisible()

  // Read the pre-fill first: toggling away clears this card's drafts.
  const weightInputs = card.getByLabel(`Weight in pounds for Bench Press`)
  const repsInputs = card.getByLabel(`Reps for Bench Press`)
  await expect(weightInputs).toHaveCount(2)
  await expect(repsInputs).toHaveCount(2)

  const currentWeight = await weightInputs.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  )
  const currentReps = await repsInputs.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  )
  const currentPairs = currentWeight.map((weight: string, index: number) => `${weight}x${currentReps[index]}`)

  await openPastView(session, exerciseId)
  await expect(rowsOf(page, exerciseId)).toHaveCount(2)

  const pastRows = await readRows(page, exerciseId)
  const pastPairs = pastRows.map((row) => `${row.lb}x${row.reps}`)

  expect(pastPairs).toEqual(currentPairs)
  expect(pastPairs).toEqual(['135x5', '225x3'])
})

// ── 8. toggling is idempotent ──────────────────────────────────────────────────

test('past then current then past returns the same rows, the same counts, and no duplicates', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Bench Press')
  seedPreviousSession(exerciseId, daysBeforeToday(7), [
    { id: 'bench-135x5', weight: 135, reps: 5, count: 3 },
    { id: 'bench-225x3', weight: 225, reps: 3, count: 2 },
  ])

  const session = await signInAsBruno(page)

  await openPastView(session, exerciseId)
  await expect(rowsOf(page, exerciseId)).toHaveCount(2)
  const firstVisit = await readRows(page, exerciseId)

  await closePastView(session, exerciseId)
  await expect(rowsRegionOf(page, exerciseId)).toHaveCount(0)

  await openPastView(session, exerciseId)
  await expect(rowsOf(page, exerciseId)).toHaveCount(2)
  const secondVisit = await readRows(page, exerciseId)

  expect(secondVisit).toEqual(firstVisit)
  expect(secondVisit.map((row) => row.dataId)).toEqual([
    `past-session-line-${exerciseId}-135-5`,
    `past-session-line-${exerciseId}-225-3`,
  ])
  expect(new Set(secondVisit.map((row) => row.dataId)).size).toBe(secondVisit.length)
})
