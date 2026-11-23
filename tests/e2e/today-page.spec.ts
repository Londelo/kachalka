import Database from 'better-sqlite3'
import { test, expect, type Page, type Request } from '@playwright/test'
import { loginAsBruno } from './helpers'
import { getTodayISO, jsDayToAppIndex } from '@/shared/utils/date'

// ============================================================================
// Feature: Idle Save Timer — Today's Battle
//
// Proves the five-second idle save is actually wired into the Today's Battle
// entry flow, in a real browser against the real stack: the controller is
// really constructed, really armed by the page's own handlers, really fires
// logWorkoutAction on its own per-exercise clock, and really reaches the
// commander on success, on failure and on leave.
//
// The save is proved on the wire, not just on the screen — every claim below
// counts POSTs that carry a logWorkoutAction argument tuple, so a save that
// renders but never crosses the boundary cannot pass.
//
// The timer itself is NOT re-proven here. Its window, its re-arm rule, its
// state machine and its flush semantics are the micro tier's, already proved
// with fake timers in tests/unit/features/workout/idle-save-controller.spec.ts.
// Here the timer is observed only through the browser.
// ============================================================================

const db = new Database('data/kachalka.db')
db.pragma('foreign_keys = ON')

db.exec('DELETE FROM workout_logs')
db.exec('DELETE FROM user_routines')
db.exec('DELETE FROM exercises')
db.exec('DELETE FROM users')
db.exec('DELETE FROM sqlite_sequence')

const USER_ID = 1
const IDLE_MS = 5000

/** Anything that only settles after a save has waited out its window and round-tripped. */
const PAST_THE_WINDOW = { timeout: 30000 }

// ============================================================================
// The wire
//
// A Next.js server action is a POST carrying the action's argument tuple as its
// body, sent to whatever url the router is on at the time — which for a save
// flushed during unmount is the page the commander navigated TO, not /today.
// So the save is identified by the shape the component is contracted to send,
// not by a url or a build-artifact action hash: logWorkoutAction(userId,
// exerciseId, date, sets) — four arguments, the third an ISO date, the last an
// array. getTodayExercisesAction sends two, getTodayWorkoutsAction one.
// Reading the tuple also makes each test assert the bytes the endpoint got.
// ============================================================================

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type SaveCall = {
  exerciseId: number
  date: string
  sets: Record<string, unknown>[]
  at: number
}

function watchSaves(page: Page): SaveCall[] {
  const calls: SaveCall[] = []
  page.on('request', (req: Request) => {
    if (req.method() !== 'POST') return
    const body = req.postData()
    if (!body) return
    let args: unknown
    try {
      args = JSON.parse(body)
    } catch {
      return
    }
    if (!Array.isArray(args) || args.length !== 4) return
    const [userId, exerciseId, date, sets] = args as [unknown, unknown, unknown, unknown]
    if (typeof userId !== 'number' || typeof exerciseId !== 'number') return
    if (typeof date !== 'string' || !ISO_DATE.test(date)) return
    if (!Array.isArray(sets)) return
    calls.push({
      exerciseId,
      date,
      sets: sets as Record<string, unknown>[],
      at: Date.now(),
    })
  })
  return calls
}

function callsFor(calls: SaveCall[], exerciseId: number): SaveCall[] {
  return calls.filter((c) => c.exerciseId === exerciseId)
}

/**
 * The window the controller is contracted to hold: five seconds from the last
 * change, plus room for the browser's own scheduling and for this event to
 * reach Playwright. A save that fired on a 500 ms debounce, on a re-arm that
 * never happened, or on a shared clock lands outside this band.
 */
function expectIdleWindow(elapsedMs: number, message: string): void {
  expect(elapsedMs, message).toBeGreaterThanOrEqual(IDLE_MS - 300)
  expect(elapsedMs, message).toBeLessThan(IDLE_MS + 3000)
}

/**
 * A polling assertion, not a sleep — the feature under test IS a clock, so the
 * only honest way to say "late in the window" is to wait on elapsed time.
 */
async function elapsedAtLeast(from: number, ms: number): Promise<void> {
  await expect.poll(() => Date.now() - from, { timeout: 30000 }).toBeGreaterThanOrEqual(ms)
}

// ============================================================================
// Storage
// ============================================================================

/** The column is Drizzle text/json — a string written in comes back wrapped once more. */
function parseSetsColumn(column: string): Record<string, unknown>[] {
  let parsed: unknown = JSON.parse(column)
  if (typeof parsed === 'string') parsed = JSON.parse(parsed)
  if (!Array.isArray(parsed)) throw new Error(`unexpected sets column: ${column.slice(0, 120)}`)
  return parsed as Record<string, unknown>[]
}

function readStoredSets(exerciseId: number): Record<string, unknown>[] | null {
  const row = db
    .prepare('SELECT sets FROM workout_logs WHERE user_id = ? AND exercise_id = ? AND date = ?')
    .get(USER_ID, exerciseId, getTodayISO()) as { sets: string } | undefined
  if (!row) return null
  return parseSetsColumn(row.sets)
}

function storedLines(exerciseId: number): { count: number | null; weight: number; reps: number }[] | null {
  const raw = readStoredSets(exerciseId)
  if (raw === null) return null
  return raw.map((line) => ({
    count: (line.count as number | undefined) ?? null,
    weight: line.weight as number,
    reps: line.reps as number,
  }))
}

async function expectStoredLines(
  exerciseId: number,
  expected: { count: number | null; weight: number; reps: number }[],
): Promise<void> {
  await expect
    .poll(() => storedLines(exerciseId), { timeout: 30000, message: `stored lines for exercise ${exerciseId}` })
    .toEqual(expected)
}

function seedExerciseOnToday(name: string): number {
  const info = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run(name, USER_ID)
  const exerciseId = Number(info.lastInsertRowid)
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(
    USER_ID,
    exerciseId,
    jsDayToAppIndex(new Date().getDay()),
  )
  return exerciseId
}

// ============================================================================
// Locators — every element by the data-id the feature ships
// ============================================================================

function card(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function weightBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-weight-input-${exerciseId}-${index}"]`)
}

function repsBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-reps-input-${exerciseId}-${index}"]`)
}

function countBox(page: Page, exerciseId: number, index: number) {
  return page.locator(`[data-id="set-count-input-${exerciseId}-${index}"]`)
}

function saveStateMarker(page: Page, exerciseId: number) {
  return page.locator(`[data-id="save-state-${exerciseId}"]`)
}

function saveError(page: Page, exerciseId: number) {
  return page.locator(`[data-id="save-error-${exerciseId}"]`)
}

function addSetButton(page: Page, exerciseId: number) {
  return card(page, exerciseId).getByRole('button', { name: 'ADD A SET' })
}

async function openTodayPage(page: Page, ...exerciseIds: number[]): Promise<void> {
  await loginAsBruno(page)
  await page.goto('http://localhost:3111/today')
  await expect(page.getByRole('heading', { name: "TODAY'S BATTLE" })).toBeVisible()
  for (const id of exerciseIds) {
    await expect(card(page, id)).toBeVisible()
  }
}

async function leaveTodayViaDrawer(page: Page, href: 'plan' | 'today'): Promise<void> {
  await page.locator('#header-nav-btn').click()
  await page.getByRole('link', { name: href === 'plan' ? 'PLAN' : 'WORKOUT' }).click()
  await expect(page).toHaveURL(new RegExp(`/${href}$`))
}

// ============================================================================
// Shared setup
// ============================================================================

test.beforeEach(() => {
  db.prepare('INSERT OR REPLACE INTO users (id, name, is_active) VALUES (?, ?, ?)').run(USER_ID, 'Bruno', 1)
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises')")
})

test.afterEach(() => {
  db.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(USER_ID)
  db.prepare('DELETE FROM user_routines WHERE user_id = ?').run(USER_ID)
  db.prepare('DELETE FROM exercises WHERE user_id = ?').run(USER_ID)
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'exercises'")
})

// ============================================================================
// The flow, proved wired
// ============================================================================

test('a burst of five changes to one exercise crosses the wire as exactly one save, five seconds after the last one', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Bench Press')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseId)

  // Five changes in quick succession: keystrokes in LB and REPS, then ADD A SET.
  await weightBox(page, exerciseId, 0).fill('100')
  await weightBox(page, exerciseId, 0).fill('135')
  await weightBox(page, exerciseId, 0).fill('1350')
  await repsBox(page, exerciseId, 0).fill('5')
  await repsBox(page, exerciseId, 0).fill('50')
  await addSetButton(page, exerciseId).click()
  const lastChangeAt = Date.now()

  // The burst collapsed to one request, and it carries what was typed.
  await expect.poll(() => callsFor(saves, exerciseId).length, { timeout: 30000 }).toBe(1)
  const [call] = callsFor(saves, exerciseId)

  expectIdleWindow(call.at - lastChangeAt, 'one save, five seconds after the last change')
  expect(call.date, 'the save carries today from the page').toBe(getTodayISO())
  expect(
    call.sets.map(({ id, ...line }) => line),
    'the payload is the two lines the commander typed, nothing dropped or invented',
  ).toEqual([
    { count: 1, weight: 1350, reps: 50 },
    { count: 1, weight: 0, reps: 1 },
  ])
  expect(call.sets.every((s) => typeof s.id === 'string' && s.id.length > 0)).toBe(true)

  // Nothing fired a second time after the window closed.
  await elapsedAtLeast(lastChangeAt, IDLE_MS + 2000)
  expect(callsFor(saves, exerciseId)).toHaveLength(1)

  await expectStoredLines(exerciseId, [
    { count: 1, weight: 1350, reps: 50 },
    { count: 1, weight: 0, reps: 1 },
  ])
})

test('a change late in the window pushes that exercise out by a full five seconds from that change', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Back Squat')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseId)

  await weightBox(page, exerciseId, 0).fill('95')
  const firstChangeAt = Date.now()

  // Interpose inside the first window — late enough that the first timer would
  // already have fired had the second change not re-armed it.
  await elapsedAtLeast(firstChangeAt, IDLE_MS - 800)
  await repsBox(page, exerciseId, 0).fill('8')
  const lastChangeAt = Date.now()

  await expect.poll(() => callsFor(saves, exerciseId).length, { timeout: 30000 }).toBe(1)
  const [call] = callsFor(saves, exerciseId)

  // Measured from the SECOND change, not the first — and still one request only.
  expectIdleWindow(call.at - lastChangeAt, 'the save is five seconds from the most recent change')
  expect(
    call.at - firstChangeAt,
    'the first window alone would have expired before this request',
  ).toBeGreaterThan(IDLE_MS)
  expect(call.sets.map(({ id, ...line }) => line)).toEqual([{ count: 1, weight: 95, reps: 8 }])
})

test('exercise B neither delays nor triggers exercise A — each saves on its own clock', async ({
  page,
}) => {
  const exerciseA = seedExerciseOnToday('Deadlift')
  const exerciseB = seedExerciseOnToday('Barbell Row')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseA, exerciseB)

  await weightBox(page, exerciseA, 0).fill('225')
  await repsBox(page, exerciseA, 0).fill('3')
  const aChangedAt = Date.now()

  // Arm B late inside A's window.
  await elapsedAtLeast(aChangedAt, IDLE_MS - 700)
  await weightBox(page, exerciseB, 0).fill('135')
  await repsBox(page, exerciseB, 0).fill('10')
  const bChangedAt = Date.now()

  await expect.poll(() => callsFor(saves, exerciseA).length, { timeout: 30000 }).toBe(1)
  await expect.poll(() => callsFor(saves, exerciseB).length, { timeout: 30000 }).toBe(1)

  const [callA] = callsFor(saves, exerciseA)
  const [callB] = callsFor(saves, exerciseB)

  // A kept its own clock: five seconds from A's change, not from B's, and not
  // pushed out by the exercise armed inside its window.
  expectIdleWindow(callA.at - aChangedAt, "exercise A saves on its own clock")
  expect(
    callA.at,
    "B's change did not delay A past B's own window",
  ).toBeLessThan(callB.at)
  expect(
    callA.at - bChangedAt,
    'A fired while B was still waiting, so B did not hold it',
  ).toBeLessThan(IDLE_MS)

  // B kept its own too, and neither exercise borrowed the other's request.
  expectIdleWindow(callB.at - bChangedAt, 'exercise B saves five seconds from its own change')
  expect(callA.sets.map(({ id, ...line }) => line)).toEqual([{ count: 1, weight: 225, reps: 3 }])
  expect(callB.sets.map(({ id, ...line }) => line)).toEqual([{ count: 1, weight: 135, reps: 10 }])

  await elapsedAtLeast(bChangedAt, IDLE_MS + 2000)
  expect(saves, 'exactly two saves crossed the wire, one per exercise').toHaveLength(2)

  await expectStoredLines(exerciseA, [{ count: 1, weight: 225, reps: 3 }])
  await expectStoredLines(exerciseB, [{ count: 1, weight: 135, reps: 10 }])
})

test('the card reports pending while it waits, saving while the request is in flight, and nothing once it lands', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Overhead Press')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseId)

  // Throttle the network — the boundary outside the feature — so the in-flight
  // half of the machine is long enough to observe. The real server action still
  // runs and still writes; nothing about it is replaced.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 600,
    downloadThroughput: 40960,
    uploadThroughput: 40960,
  })

  await weightBox(page, exerciseId, 0).fill('95')
  await repsBox(page, exerciseId, 0).fill('8')

  const marker = saveStateMarker(page, exerciseId)
  await expect(marker, 'typing puts the card on pending').toHaveAttribute('data-save-state', 'pending')
  await expect(marker).toHaveAttribute('role', 'status')
  await expect(marker).toHaveAttribute('aria-live', 'polite')
  await expect(marker).toHaveText('PENDING...')

  await expect(
    marker,
    'the fired save is reported as saving',
  ).toHaveAttribute('data-save-state', 'saving', PAST_THE_WINDOW)
  await expect(marker).toHaveText('SAVING...', PAST_THE_WINDOW)

  await expect(marker, 'the marker is gone once the save lands').toHaveCount(0, PAST_THE_WINDOW)
  await expect.poll(() => callsFor(saves, exerciseId).length, PAST_THE_WINDOW).toBe(1)
  await expectStoredLines(exerciseId, [{ count: 1, weight: 95, reps: 8 }])
})

test('what the idle save wrote comes back from storage on reload, counts included, for every exercise', async ({
  page,
}) => {
  const exerciseA = seedExerciseOnToday('Romanian Deadlift')
  const exerciseB = seedExerciseOnToday('Lat Pulldown')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseA, exerciseB)

  await weightBox(page, exerciseA, 0).fill('185')
  await repsBox(page, exerciseA, 0).fill('6')
  await countBox(page, exerciseA, 0).fill('4')
  await addSetButton(page, exerciseA).click()
  await weightBox(page, exerciseA, 1).fill('135')
  await repsBox(page, exerciseA, 1).fill('12')
  await countBox(page, exerciseA, 1).fill('2')

  await weightBox(page, exerciseB, 0).fill('90')
  await repsBox(page, exerciseB, 0).fill('10')

  await expect.poll(() => saves.length, { timeout: 30000 }).toBe(2)
  await expectStoredLines(exerciseA, [
    { count: 4, weight: 185, reps: 6 },
    { count: 2, weight: 135, reps: 12 },
  ])
  await expectStoredLines(exerciseB, [{ count: 1, weight: 90, reps: 10 }])

  await page.reload()
  await expect(card(page, exerciseA)).toBeVisible()
  await expect(card(page, exerciseB)).toBeVisible()

  await expect(countBox(page, exerciseA, 0)).toHaveValue('4')
  await expect(weightBox(page, exerciseA, 0)).toHaveValue('185')
  await expect(repsBox(page, exerciseA, 0)).toHaveValue('6')
  await expect(countBox(page, exerciseA, 1)).toHaveValue('2')
  await expect(weightBox(page, exerciseA, 1)).toHaveValue('135')
  await expect(repsBox(page, exerciseA, 1)).toHaveValue('12')
  await expect(countBox(page, exerciseB, 0)).toHaveValue('1')
  await expect(weightBox(page, exerciseB, 0)).toHaveValue('90')
  await expect(repsBox(page, exerciseB, 0)).toHaveValue('10')
})

test('leaving the page with a save pending flushes it and the typed work is there on return', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Front Squat')
  const saves = watchSaves(page)
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await openTodayPage(page, exerciseId)

  await weightBox(page, exerciseId, 0).fill('165')
  await repsBox(page, exerciseId, 0).fill('5')
  const changedAt = Date.now()

  // Leave well inside the window, the way the commander actually leaves — a
  // client-side route change through the drawer, which is what unmounts the page.
  await leaveTodayViaDrawer(page, 'plan')
  const leftAt = Date.now()

  // The flush fired the pending save during unmount: it crossed the wire long
  // before the five-second window could have expired.
  await expect.poll(() => callsFor(saves, exerciseId).length, { timeout: 15000 }).toBe(1)
  const [call] = callsFor(saves, exerciseId)
  expect(
    call.at - changedAt,
    'the pending save fired on leaving, not when its window expired',
  ).toBeLessThan(IDLE_MS - 1000)
  expect(call.sets.map(({ id, ...line }) => line)).toEqual([{ count: 1, weight: 165, reps: 5 }])

  // No timer survived the flush to fire a second save into the unmounted page.
  await elapsedAtLeast(changedAt, IDLE_MS + 2000)
  expect(callsFor(saves, exerciseId)).toHaveLength(1)
  expect(
    consoleErrors.filter((text) => /unmounted|Cannot update a component/i.test(text)),
    `no setState-after-teardown warning: ${consoleErrors.join(' | ')}`,
  ).toEqual([])

  await leaveTodayViaDrawer(page, 'today')
  await expect(card(page, exerciseId)).toBeVisible()
  await expect(weightBox(page, exerciseId, 0)).toHaveValue('165')
  await expect(repsBox(page, exerciseId, 0)).toHaveValue('5')
  await expectStoredLines(exerciseId, [{ count: 1, weight: 165, reps: 5 }])
})

// ============================================================================
// Errors and failure surfaces
// ============================================================================

test('a save the server refuses is shown on that exercise card and the typed lines stay exactly as typed', async ({
  page,
}) => {
  const failing = seedExerciseOnToday('Power Clean')
  const untouched = seedExerciseOnToday('Hang Clean')
  const saves = watchSaves(page)

  await openTodayPage(page, failing, untouched)

  await weightBox(page, failing, 0).fill('95')
  await countBox(page, failing, 0).fill('3')
  await repsBox(page, failing, 0).fill('0')
  const changedAt = Date.now()

  // The server action's own string, verbatim, on the card that earned it.
  await expect(saveError(page, failing), 'the refusal reaches the commander').toHaveText(
    'Reps must be at least 1',
    PAST_THE_WINDOW,
  )
  await expect(saveError(page, failing)).toHaveAttribute('role', 'alert')
  await expect(saveStateMarker(page, failing)).toHaveAttribute('data-save-state', 'error')

  // Nothing was silently reverted. `defaultSet()` is { count: 1, reps: 1, weight: 0 },
  // so a wipe would put those three bytes back on screen; each box below still holds
  // what was typed instead. The REPS box reads blank because the page renders
  // `value={set.reps || ''}` — that is what a typed zero looks like here, and it is
  // not the default line's `1`.
  await expect(weightBox(page, failing, 0)).toHaveValue('95')
  await expect(countBox(page, failing, 0)).toHaveValue('3')
  await expect(repsBox(page, failing, 0)).toHaveValue('')

  // The other exercise's card is untouched by its neighbour's failure.
  await expect(saveError(page, untouched)).toHaveCount(0)
  await expect(saveStateMarker(page, untouched)).toHaveCount(0)

  // The rejected write never reached storage, and it left the browser carrying
  // exactly what was typed — the refusal happened on the server, not in the page.
  const [call] = callsFor(saves, failing)
  expect(call.at - changedAt, 'the failing save still waited out the window').toBeGreaterThanOrEqual(
    IDLE_MS - 300,
  )
  expect(call.sets, 'the refused payload still holds the typed bytes').toMatchObject([
    { count: 3, weight: 95, reps: 0 },
  ])
  expect(readStoredSets(failing)).toBeNull()
})

test('an exercise whose save failed is not wedged — the next change clears the error and saves', async ({
  page,
}) => {
  const exerciseId = seedExerciseOnToday('Push Press')
  const saves = watchSaves(page)

  await openTodayPage(page, exerciseId)

  await weightBox(page, exerciseId, 0).fill('80')
  await repsBox(page, exerciseId, 0).fill('0')
  const firstAttemptAt = Date.now()
  await expect(saveError(page, exerciseId)).toHaveText('Reps must be at least 1', PAST_THE_WINDOW)
  await expect.poll(() => callsFor(saves, exerciseId).length, PAST_THE_WINDOW).toBe(1)
  expect(
    callsFor(saves, exerciseId)[0].at - firstAttemptAt,
    'the failing attempt went through the same idle window',
  ).toBeGreaterThanOrEqual(IDLE_MS - 300)

  // A second attempt on the same card: the error clears and the save lands.
  await repsBox(page, exerciseId, 0).fill('7')
  const retryAt = Date.now()

  await expect(saveStateMarker(page, exerciseId), 'the card is back on pending').toHaveAttribute(
    'data-save-state',
    'pending',
  )
  await expect(saveError(page, exerciseId), 'the error is gone').toHaveCount(0)

  await expect.poll(() => callsFor(saves, exerciseId).length, { timeout: 30000 }).toBe(2)
  const [, second] = callsFor(saves, exerciseId)
  expectIdleWindow(second.at - retryAt, 'the retry waits its own five seconds')
  expect(second.sets.map(({ id, ...line }) => line)).toEqual([{ count: 1, weight: 80, reps: 7 }])

  await expect(saveStateMarker(page, exerciseId)).toHaveCount(0)
  await expectStoredLines(exerciseId, [{ count: 1, weight: 80, reps: 7 }])
})
