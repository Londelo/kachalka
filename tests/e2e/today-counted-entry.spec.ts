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

// ── clocks ────────────────────────────────────────────────────────────────────
//
// The page stamps a log with the BROWSER's local calendar day
// (today/page.tsx:411 getTodayLocalDate()), while the pre-fill reads back on the
// SERVER's local calendar day (workout-server-actions.ts:78) and the rest of the
// suite has historically asserted the UTC day. Three clocks, and only the first
// one is what a save writes. `dateInZone` therefore reads a calendar day straight
// off Intl rather than importing the app's own formatter, so a case below can
// accuse the page of stamping the wrong clock without being judged by that clock.

function dateInZone(timeZone: string, instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const read = (kind: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === kind)?.value ?? ''

  const year = read('year')
  const month = read('month')
  const day = read('day')
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
    throw new Error(`Intl gave a malformed calendar day for ${timeZone}: ${year}-${month}-${day}`)
  }

  return `${year}-${month}-${day}`
}

function appDayIndexInZone(timeZone: string, instant: Date = new Date()): number {
  const [year, month, day] = dateInZone(timeZone, instant).split('-').map(Number)
  return jsDayToAppIndex(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
}

const MACHINE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const UTC_DATE = dateInZone('UTC')
const MACHINE_LOCAL_DATE = dateInZone(MACHINE_ZONE)
const BROWSER_LOCAL_DATE = MACHINE_LOCAL_DATE

// Journey 7 only means something when the browser's local day is NOT the UTC day
// and NOT the server's local day either — otherwise a UTC-stamping or
// server-clock-stamping page would store the very same string and pass. Zones are
// scanned rather than named so the case picks its own witness at run time; see the
// case itself for how to force the interesting hour on a machine that needs one.
const DIVERGENT_ZONES = [
  'Etc/GMT+12',
  'Etc/GMT-14',
  'Etc/GMT+11',
  'Etc/GMT-13',
  'Etc/GMT+10',
  'Etc/GMT-12',
  'Pacific/Kwajalein',
  'Etc/GMT-11',
]

function pickDivergentZone(): string {
  const now = new Date()
  const zone = DIVERGENT_ZONES.find((candidate) => {
    const local = dateInZone(candidate, now)
    return local !== UTC_DATE && local !== MACHINE_LOCAL_DATE
  })

  if (zone === undefined) {
    throw new Error(
      `No candidate zone disagrees with both the UTC day (${UTC_DATE}) and the ` +
        `server day (${MACHINE_LOCAL_DATE}) right now — the local-day journey has ` +
        `no witness at this hour and would pass vacuously.`,
    )
  }

  return zone
}

const DIVERGENT_ZONE = pickDivergentZone()
const DIVERGENT_LOCAL_DATE = dateInZone(DIVERGENT_ZONE)
const DIVERGENT_DAY_INDEX = appDayIndexInZone(DIVERGENT_ZONE)

// ── database doors ────────────────────────────────────────────────────────────

function parseStoredSets(raw: unknown): StoredSet[] {
  let value = raw
  for (let depth = 0; depth < 3 && typeof value === 'string'; depth += 1) {
    value = JSON.parse(value)
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `workout_logs.sets is not an array: typeof ${typeof value} / ${JSON.stringify(raw)}`,
    )
  }

  return (value as Record<string, unknown>[]).map((line) => ({
    weight: Number(line.weight),
    reps: Number(line.reps),
    count: line.count === undefined || line.count === null ? null : Number(line.count),
  }))
}

interface StoredRow {
  id: number
  date: string
  sets: StoredSet[]
}

function rowsFor(exerciseId: number, date: string): StoredRow[] {
  const rows = db
    .prepare('SELECT id, date, sets FROM workout_logs WHERE user_id = ? AND exercise_id = ? AND date = ?')
    .all(BRUNO_USER_ID, exerciseId, date) as { id: number; date: string; sets: unknown }[]

  return rows.map((row) => ({ id: Number(row.id), date: row.date, sets: parseStoredSets(row.sets) }))
}

function storedSets(exerciseId: number, date: string): StoredSet[] | null {
  const rows = rowsFor(exerciseId, date)
  return rows.length === 0 ? null : rows[0].sets
}

function seedExerciseScheduledInZone(name: string, dayIndex: number): number {
  const exerciseId = Number(
    db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)').run(name, BRUNO_USER_ID)
      .lastInsertRowid,
  )
  db.prepare('INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)').run(
    BRUNO_USER_ID,
    exerciseId,
    dayIndex,
  )
  return exerciseId
}

function seedExerciseScheduledToday(name: string): number {
  return seedExerciseScheduledInZone(name, appDayIndexInZone(MACHINE_ZONE))
}

type SeededLine = { id: string; weight: number; reps: number; count: number }

// The pre-fill door reads on the SERVER's local day, so a row meant to come back
// into the card as an already-numbered line has to be written on that day.
function seedSavedSet(exerciseId: number, date: string, sets: SeededLine[]): void {
  db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
  ).run(BRUNO_USER_ID, exerciseId, date, JSON.stringify(sets))
}

// ── the page ──────────────────────────────────────────────────────────────────

function cardOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id="exercise-card-${exerciseId}"]`)
}

function errorOf(page: Page, exerciseId: number) {
  return cardOf(page, exerciseId).locator(`[data-id="card-error-${exerciseId}"]`)
}

function rowIdsOf(page: Page, exerciseId: number) {
  return page.locator(`[data-id^="set-count-${exerciseId}-"]`)
}

// The keyed identity of each row on the card, read off the data-id the shell puts
// there. A row that comes back under a different one was unmounted and remounted.
function rowIdValuesOf(page: Page, exerciseId: number): Promise<string[]> {
  return rowIdsOf(page, exerciseId).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-id') ?? ''),
  )
}

function inputOf(page: Page, exerciseId: number, name: string, field: 'count' | 'weight' | 'reps', index = 0) {
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

// ── the two server actions, told apart by their argument lists ────────────────
//
// Both POST to /today and their Next-Action ids are per-build hashes, but
// getTodayWorkoutsAction takes (userId) alone and logWorkoutAction takes
// (userId, exerciseId, date, sets). The argument list is therefore the only
// stable way to say which one answered, and the pre-fill is the one thing every
// keystroke below has to wait for: a bare setExerciseSets in that response's
// continuation replaces the whole draft Map, so a keystroke typed before it lands
// is silently discarded and the case then reads back null and looks like a broken
// write path when what broke was a keystroke.

interface SentSave {
  exerciseId: number
  date: string
  sets: StoredSet[]
  urlAtSend: string
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
    urlAtSend: request.url(),
    sets: (sets as Record<string, unknown>[]).map((line) => ({
      weight: Number(line.weight),
      reps: Number(line.reps),
      count: line.count === undefined || line.count === null ? null : Number(line.count),
    })),
  }
}

async function signInAsBruno(page: Page): Promise<TodaySession> {
  await loginAsBruno(page)

  const cookies = await page.context().cookies(BASE_URL)
  expect(
    cookies.some((cookie) => cookie.name === 'kachalka.userId' && cookie.value === '1'),
    'loginAsBruno must set kachalka.userId=1 before any save is relied upon',
  ).toBe(true)

  const saves: SentSave[] = []
  const prefillResponses: Response[] = []

  page.on('request', (request) => {
    const save = saveOf(request)
    if (save !== null) saves.push(save)
  })
  page.on('response', (response) => {
    if (isWorkoutsPrefill(response.request())) prefillResponses.push(response)
  })

  await page.goto(`${BASE_URL}/today`)

  return { page, saves, prefillResponses }
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
        'the mount effect never delivered getTodayWorkoutsAction, so the bare ' +
        'setExerciseSets in its continuation is still unapplied and a keystroke ' +
        'typed now would be silently discarded',
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

function savesFor(session: TodaySession, exerciseId: number): SentSave[] {
  return session.saves.filter((save) => save.exerciseId === exerciseId)
}

type RowValues = { count: string; weight: string; reps: string }

// Typed in the order the row lays them out — SET, LB, REPS. A row becomes
// collapsible the instant weight AND reps are both numbers, and a collapse hands
// every surviving row a fresh id, so filling REPS last keeps the row the person
// is typing into at the same index for the whole keystroke.
//
// Nothing is asserted between the keystrokes: the keystroke that completes a
// duplicate pair destroys the row it was typed into, so an assertion aimed at
// that row would be aiming at an element the page has already folded away. What
// the page holds after the typing is expectRowValues' job, and it guards the
// mount pre-fill — a keystroke discarded by it shows up there as a field that
// never took the text. It does NOT guard a character swallowed between two
// characters: fill() hands the whole string over in one input event, so there is
// no between-two-characters for it to lose one in. The keystroke journey at the
// foot of this file is the only guard for that.
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

async function awaitStoredSets(
  session: TodaySession,
  exerciseId: number,
  date: string,
  expected: StoredSet[],
): Promise<void> {
  await expect
    .poll(() => storedSets(exerciseId, date), {
      message: `the save never reached workout_logs for exercise ${exerciseId} on ${date}`,
    })
    .toEqual(expected)

  const last = savesFor(session, exerciseId).at(-1)
  expect(
    last,
    `no logWorkoutAction was ever sent for exercise ${exerciseId}, so the row in ` +
      `workout_logs for it on ${date} was not written by this keystroke`,
  ).toBeDefined()
  expect(last?.date, 'the save went to the date the page stamps').toBe(date)
  expect(last?.sets).toEqual(expected)
}

async function openDrawer(page: Page): Promise<void> {
  await page.locator('#header-nav-btn').click()
}

// A drawer tab's accessible name is its icon ligature plus its label — "settings
// PLAN" — so these match on the label as a substring rather than exactly. No tab
// label is a substring of another, so each still names one link.
function drawerTab(page: Page, label: string) {
  return page.getByRole('link', { name: label })
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

test('a counted set persists to the row and comes back into its SET field after a reload', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Counted Persist')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await typeSet(session, exerciseId, 'Counted Persist', { count: '3', weight: '135', reps: '5' })
  await expectRowValues(page, exerciseId, 'Counted Persist', {
    count: '3',
    weight: '135',
    reps: '5',
  })
  await awaitStoredSets(session, exerciseId, BROWSER_LOCAL_DATE, [
    { weight: 135, reps: 5, count: 3 },
  ])

  expect(rowsFor(exerciseId, BROWSER_LOCAL_DATE)).toHaveLength(1)

  await page.reload()
  await expect(cardOf(page, exerciseId)).toBeVisible()

  await expect(inputOf(page, exerciseId, 'Counted Persist', 'count')).toHaveValue('3')
  await expect(inputOf(page, exerciseId, 'Counted Persist', 'weight')).toHaveValue('135')
  await expect(inputOf(page, exerciseId, 'Counted Persist', 'reps')).toHaveValue('5')
})

test('two identical lines collapse into one line carrying the summed count', async ({ page }) => {
  const exerciseId = seedExerciseScheduledToday('Counted Collapse')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await typeSet(session, exerciseId, 'Counted Collapse', { count: '3', weight: '135', reps: '5' })
  await expectRowValues(page, exerciseId, 'Counted Collapse', {
    count: '3',
    weight: '135',
    reps: '5',
  })

  await addButtonOf(page, exerciseId).click()
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(2)

  await typeSet(
    session,
    exerciseId,
    'Counted Collapse',
    { count: '3', weight: '135', reps: '5' },
    1,
  )

  // The second line is gone: the keystroke that completed the duplicate pair
  // folded it into the first, and the surviving line carries 3 + 3.
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(1)
  await expectRowValues(page, exerciseId, 'Counted Collapse', {
    count: '6',
    weight: '135',
    reps: '5',
  })

  await awaitStoredSets(session, exerciseId, BROWSER_LOCAL_DATE, [
    { weight: 135, reps: 5, count: 6 },
  ])

  expect(rowsFor(exerciseId, BROWSER_LOCAL_DATE)).toHaveLength(1)
})

test('a refused value is that card problem alone — the other card still saves', async ({
  page,
}) => {
  const exerciseA = seedExerciseScheduledToday('Counted Refused A')
  const exerciseB = seedExerciseScheduledToday('Counted Refused B')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseA)).toBeVisible()
  await expect(cardOf(page, exerciseB)).toBeVisible()

  await typeSet(session, exerciseA, 'Counted Refused A', { count: '2', weight: '0', reps: '5' })

  await expect(errorOf(page, exerciseA)).toHaveText(
    'Weight must be more than 0 — enter the weight you lifted, or remove the line.',
  )

  await typeSet(session, exerciseB, 'Counted Refused B', { count: '1', weight: '95', reps: '10' })
  await awaitStoredSets(session, exerciseB, BROWSER_LOCAL_DATE, [
    { weight: 95, reps: 10, count: 1 },
  ])

  await expect(errorOf(page, exerciseB)).toHaveCount(0)
  await expect(cardOf(page, exerciseB).locator('[role="alert"]')).toHaveCount(0)

  expect(rowsFor(exerciseA, BROWSER_LOCAL_DATE)).toHaveLength(0)
  expect(rowsFor(exerciseB, BROWSER_LOCAL_DATE)).toHaveLength(1)
})

test('junk in a weight field stays on screen as junk and writes no row', async ({ page }) => {
  const exerciseId = seedExerciseScheduledToday('Counted Junk')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()

  // Typed one character at a time, the way a hand types it, so it is the browser
  // that decides whether `heavy` is an acceptable value for this control and not
  // Playwright deciding on its behalf before the page ever saw the key.
  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, 1)

  const countField = inputOf(page, exerciseId, 'Counted Junk', 'count')
  await countField.click()
  await countField.pressSequentially('2', { delay: KEYSTROKE_DELAY_MS })

  const weightField = inputOf(page, exerciseId, 'Counted Junk', 'weight')
  await weightField.click()
  await weightField.pressSequentially('heavy', { delay: KEYSTROKE_DELAY_MS })

  const repsField = inputOf(page, exerciseId, 'Counted Junk', 'reps')
  await repsField.click()
  await repsField.pressSequentially('5', { delay: KEYSTROKE_DELAY_MS })

  // The card error is the fingerprint that the scheduled callback ran and chose
  // not to call the server, so the request count below is a refusal, not a race.
  await expect(errorOf(page, exerciseId)).toHaveText(
    'WEIGHT must be a number, or remove the line.',
  )

  await expect(weightField).toHaveValue('heavy')
  await expect(weightField).not.toHaveValue('0')
  await expect(weightField).not.toHaveValue('')

  expect(savesFor(session, exerciseId)).toHaveLength(0)
  expect(rowsFor(exerciseId, BROWSER_LOCAL_DATE)).toHaveLength(0)
})

test('leaving the page before the debounce elapses still writes the set', async ({ page }) => {
  const exerciseId = seedExerciseScheduledToday('Counted Navigation')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await typeSet(session, exerciseId, 'Counted Navigation', { count: '2', weight: '225', reps: '8' })
  await expectRowValues(page, exerciseId, 'Counted Navigation', {
    count: '2',
    weight: '225',
    reps: '8',
  })

  const pendingAtDeparture = savesFor(session, exerciseId).length
  expect(
    pendingAtDeparture,
    'the 500ms debounce elapsed while the page was still on /today, so this case ' +
      'proved the timer rather than the unmount flush — nothing about navigation ' +
      'was at risk',
  ).toBe(0)

  await openDrawer(page)
  await drawerTab(page, 'PLAN').click()
  await expect(page).toHaveURL(/\/plan$/)

  await expect
    .poll(() => storedSets(exerciseId, BROWSER_LOCAL_DATE), {
      message:
        'the row never landed: the unmount cleanup did not flush the pending save',
    })
    .toEqual([{ weight: 225, reps: 8, count: 2 }])

  // The URL the request left from is what separates the two ways this row could
  // have been written. A timer that had already fired would have POSTed while the
  // page was still on /today; only the unmount cleanup can put a save on the wire
  // from /plan. The pendingAtDeparture check above already rules the timer out —
  // this names which code wrote the row instead of merely ruling one out.
  const flush = savesFor(session, exerciseId).at(-1)
  expect(flush, 'the save that wrote the row was never sent').toBeDefined()
  expect(
    flush?.urlAtSend,
    'the save left from /today, so the debounce timer fired before the page was ' +
      'ever left — the row proves the timer, not the unmount flush',
  ).toMatch(/\/plan$/)

  await openDrawer(page)
  await drawerTab(page, 'WORKOUT').click()
  await expect(page).toHaveURL(/\/today$/)

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await expect(inputOf(page, exerciseId, 'Counted Navigation', 'count')).toHaveValue('2')
  await expect(inputOf(page, exerciseId, 'Counted Navigation', 'weight')).toHaveValue('225')
  await expect(inputOf(page, exerciseId, 'Counted Navigation', 'reps')).toHaveValue('8')
})

test('two cards typed inside one debounce window each write their own row', async ({ page }) => {
  const exerciseA = seedExerciseScheduledToday('Counted Pair A')
  const exerciseB = seedExerciseScheduledToday('Counted Pair B')

  const session = await signInAsBruno(page)

  await expect(cardOf(page, exerciseA)).toBeVisible()
  await expect(cardOf(page, exerciseB)).toBeVisible()

  await typeSet(session, exerciseA, 'Counted Pair A', { count: '2', weight: '135', reps: '5' })
  await typeSet(session, exerciseB, 'Counted Pair B', { count: '4', weight: '95', reps: '10' })

  const sentWhileWindowOpen = session.saves.length
  expect(
    sentWhileWindowOpen,
    'a save already fired while the second card was still being typed into, so the ' +
      'two cards were not in one debounce window and a shared single timer would ' +
      'have passed this case anyway',
  ).toBe(0)

  await awaitStoredSets(session, exerciseA, BROWSER_LOCAL_DATE, [
    { weight: 135, reps: 5, count: 2 },
  ])
  await awaitStoredSets(session, exerciseB, BROWSER_LOCAL_DATE, [
    { weight: 95, reps: 10, count: 4 },
  ])

  expect(savesFor(session, exerciseA)).toHaveLength(1)
  expect(savesFor(session, exerciseB)).toHaveLength(1)
  expect(rowsFor(exerciseA, BROWSER_LOCAL_DATE)).toHaveLength(1)
  expect(rowsFor(exerciseB, BROWSER_LOCAL_DATE)).toHaveLength(1)
})

test.describe('the save lands on the local day', () => {
  test.use({ timezoneId: DIVERGENT_ZONE })

  // This case only carries weight while three calendar days are in play at once:
  // the browser's (DIVERGENT_ZONE), the server's, and UTC's. pickDivergentZone()
  // picks a zone for which that is true at run time, so on a machine whose local
  // hour already separates them the case is meaningful as written. To force the
  // interesting hour on one that does not, run the suite near local midnight —
  // e.g. `TZ=Asia/Tokyo npm run test:e2e` at 23:30 UTC, or hold the clock with
  // `faketime '2026-11-28 23:30:00' npm run test:e2e` — and the routine seed
  // below follows the emulated zone's weekday automatically.
  test('a set typed in a zone whose local day is not the UTC day is stored on that local day', async ({
    page,
  }) => {
    expect(
      DIVERGENT_LOCAL_DATE !== UTC_DATE && DIVERGENT_LOCAL_DATE !== MACHINE_LOCAL_DATE,
      'the chosen zone must disagree with both the UTC day and the server day',
    ).toBe(true)

    const exerciseId = seedExerciseScheduledInZone('Counted Local Day', DIVERGENT_DAY_INDEX)

    const session = await signInAsBruno(page)

    await expect(cardOf(page, exerciseId)).toBeVisible()
    await typeSet(session, exerciseId, 'Counted Local Day', {
      count: '2',
      weight: '185',
      reps: '6',
    })
    await awaitStoredSets(session, exerciseId, DIVERGENT_LOCAL_DATE, [
      { weight: 185, reps: 6, count: 2 },
    ])

    expect(rowsFor(exerciseId, DIVERGENT_LOCAL_DATE)).toHaveLength(1)
    expect(
      rowsFor(exerciseId, UTC_DATE),
      'a row on the UTC day means the page stamped the wrong clock',
    ).toHaveLength(0)
    expect(
      rowsFor(exerciseId, MACHINE_LOCAL_DATE),
      'a row on the server day means the page stamped the server clock, not the browser',
    ).toHaveLength(0)
  })
})

// ── the keystroke journey ─────────────────────────────────────────────────────
//
// Every journey above types through fill(), and fill() is not a hand: it assigns
// el.value wholesale, dispatches one input event, never focuses, never puts a caret
// anywhere, and finishes before React re-renders — so it cannot be unmounted
// mid-string, because by the time anything could remount the row the string is
// already in. The failures this feature actually has all live between two
// characters: a collapse that answers with a fresh row id, or a render that mints a
// fresh blank draft, unmounts the input under the caret and the character in flight
// goes with it; a control that will not accept the key at all never lets the
// character in to begin with. A suite built on fill() is green on all of those
// pages.
//
// KEYSTROKE_DELAY_MS is what makes the observation possible. A character has to
// arrive after React has committed the one before it, because a remount that lands
// after the burst has ended is a remount no character was standing on. 60ms is well
// past a commit of this card, and a five-character burst still sits inside one
// 500ms debounce window, so each field below is written by the single save its last
// keystroke armed.

const KEYSTROKE_DELAY_MS = 60

test('a set typed one character at a time keeps the caret and stores every character', async ({
  page,
}) => {
  const numberedId = seedExerciseScheduledToday('Keystroke Numbered')
  const blankId = seedExerciseScheduledToday('Keystroke Blank')
  const letterId = seedExerciseScheduledToday('Keystroke Letter')
  seedSavedSet(numberedId, MACHINE_LOCAL_DATE, [
    { id: 'keystroke-numbered-row', weight: 135, reps: 5, count: 3 },
  ])

  const session = await signInAsBruno(page)

  await expect(cardOf(page, numberedId)).toBeVisible()
  await expect(cardOf(page, blankId)).toBeVisible()
  await expect(cardOf(page, letterId)).toBeVisible()
  await awaitMountPrefill(session)
  await awaitQuietCard(session, numberedId, 1)
  await awaitQuietCard(session, blankId, 1)
  await awaitQuietCard(session, letterId, 1)

  // The two rows below are the two ways the page comes by the row under the caret:
  // this one arrives numbered from the pre-fill, so every keystroke runs a collapse
  // over the row being typed into; the other is a card with no saved set at all, so
  // the page has to produce that row itself. Both are captured before the first
  // keystroke: an id that comes back different is a row that was unmounted and
  // remounted under the caret, and the character in flight went with it.
  const numberedRowIds = await rowIdValuesOf(page, numberedId)
  const blankRowIds = await rowIdValuesOf(page, blankId)

  // The SET field of the numbered row, because it is the one field that leaves the
  // row collapsible the whole way through — a weight or a reps keystroke takes the
  // row in and out of the collapse's reach mid-burst.
  const numberedCount = inputOf(page, numberedId, 'Keystroke Numbered', 'count')
  await numberedCount.click()
  await numberedCount.press('End')
  await numberedCount.pressSequentially('12', { delay: KEYSTROKE_DELAY_MS })

  await expect(numberedCount).toBeFocused()
  await expect(numberedCount).toHaveValue('312')
  expect(
    await rowIdValuesOf(page, numberedId),
    'the numbered row the lifter typed into came back under a different id, so the ' +
      'collapse remounted it mid-keystroke',
  ).toEqual(numberedRowIds)

  await awaitStoredSets(session, numberedId, BROWSER_LOCAL_DATE, [
    { weight: 135, reps: 5, count: 312 },
  ])

  // SET first, on the row the page had to make: once weight and reps are both
  // numbers the collapse starts rewriting this field, and a count typed into a '1'
  // the page wrote is not the count a lifter typed into an empty field.
  const blankCount = inputOf(page, blankId, 'Keystroke Blank', 'count')
  await blankCount.click()
  await blankCount.pressSequentially('2', { delay: KEYSTROKE_DELAY_MS })
  await expect(blankCount).toBeFocused()
  await expect(blankCount).toHaveValue('2')

  // A half plate, typed the way a hand types it: the dot has to survive being its
  // own keystroke, sitting between two runs of digits while a collapse commits
  // after each one.
  const blankWeight = inputOf(page, blankId, 'Keystroke Blank', 'weight')
  await blankWeight.click()
  await blankWeight.pressSequentially('225.5', { delay: KEYSTROKE_DELAY_MS })
  await expect(blankWeight).toBeFocused()
  await expect(blankWeight).toHaveValue('225.5')

  const blankReps = inputOf(page, blankId, 'Keystroke Blank', 'reps')
  await blankReps.click()
  await blankReps.pressSequentially('8', { delay: KEYSTROKE_DELAY_MS })
  await expect(blankReps).toBeFocused()
  await expect(blankReps).toHaveValue('8')

  // The keystroke that made this row collapsible is the one the collapse answers
  // to: it rewrites the SET field, and it has to rewrite it to what was typed.
  await expect(blankCount).toHaveValue('2')

  expect(
    await rowIdValuesOf(page, blankId),
    'the row the page produced for a card with no saved set came back under a ' +
      'different id, so a render reminted it mid-keystroke',
  ).toEqual(blankRowIds)

  await awaitStoredSets(session, blankId, BROWSER_LOCAL_DATE, [
    { weight: 225.5, reps: 8, count: 2 },
  ])

  // The last leg types a character a hand can press and a number control will not
  // accept, on top of digits already in the field. A build that slipped back to
  // type="number" eats every letter at the browser, so the keystroke never reaches
  // onChange and the field comes back without them. Nothing but a real key event,
  // and the character still on screen afterwards, says which control is underneath.
  //
  // The character reaching the field is all this asserts. That the field then
  // refuses out loud and writes no row is the junk journey's claim, proved once.
  const letterWeight = inputOf(page, letterId, 'Keystroke Letter', 'weight')
  await letterWeight.click()
  await letterWeight.pressSequentially('95x', { delay: KEYSTROKE_DELAY_MS })
  await expect(letterWeight).toBeFocused()
  await expect(letterWeight).toHaveValue('95x')
})

// ── the emptied card ──────────────────────────────────────────────────────────
//
// A card's other exit from a save is not a save. When every line on it has been
// cleared, saveExercise() (today/page.tsx:452) finds no saveable draft left and
// deletes the day's row instead, spending the logId the mount pre-fill handed it
// out of getTodayWorkoutsAction's logIds. That handoff — a row in the database, its
// id carried across the wire into the page, the page choosing delete over write, the
// row gone from SQLite rather than present with an empty set list — is what none of
// the journeys above reaches: every one of them ends with a row written, never with
// one removed. A build that let the emptied card skip the delete would leave this
// file green and leave the lifter's day holding sets they erased on screen.

// The page stamps a save with getTodayLocalDate() (today/page.tsx:472) and reads the
// pre-fill back on the same helper server-side (workout-server-actions.ts:86). This
// journey is about the delete, not the clock, so it names the day with the very
// helper the page writes with: a day the page wrote is the day it looks for. The
// clock journeys above deliberately judge the page against dateInZone instead — that
// distance is what lets them accuse the page of stamping the wrong clock, and it is
// exactly what is unwanted here, where a date that disagreed with the page's own
// would make the row look deleted when it was only ever filed somewhere else.
const PAGE_LOCAL_DATE = getTodayLocalDate()

// deleteWorkoutAction(userId, logId) and getTodayExercisesAction(userId, dayOfWeek)
// both POST a two-argument list whose first entry is the user, so the arity that
// tells the save and the pre-fill apart cannot tell the delete and the exercise
// re-fetch apart. The seeded row's id does: it sits far outside the 0-6 a day of the
// week can be, so a two-argument action naming it can only be the delete.
const EMPTIED_CARD_LOG_ID = 9001

function seedSavedLogWithRowId(
  exerciseId: number,
  date: string,
  rowId: number,
  sets: SeededLine[],
): void {
  db.prepare(
    'INSERT INTO workout_logs (id, user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?, ?)',
  ).run(rowId, BRUNO_USER_ID, exerciseId, date, JSON.stringify(sets))
}

function deleteOf(request: Request, logId: number): boolean {
  const args = actionArgsOf(request)
  return args !== null && args.length === 2 && args[0] === BRUNO_USER_ID && args[1] === logId
}

// The pre-fill is what fills a card, so a card read as empty before its pre-fill
// answer has landed is empty in the only sense that matters to nobody: the mount
// effect has not been given the chance to say otherwise. Every emptiness below is
// asserted behind this, and the reload in particular has to wait for its own answer
// — a page that re-created the deleted row would look identical to one still showing
// the pre-mount fallback rows.
async function awaitPrefillAnswers(session: TodaySession, count: number): Promise<void> {
  await expect
    .poll(() => session.prefillResponses.length, {
      message:
        `fewer than ${count} getTodayWorkoutsAction answers arrived, so the card is ` +
        `still wearing the pre-mount fallback rows and an emptiness asserted now is ` +
        `an emptiness the page was never asked about`,
    })
    .toBeGreaterThanOrEqual(count)

  await drainPageMainThread(session.page)
}

test('emptying every line off a card deletes that day\'s row, and it stays gone after a reload', async ({
  page,
}) => {
  const exerciseId = seedExerciseScheduledToday('Emptied Card')
  seedSavedLogWithRowId(exerciseId, PAGE_LOCAL_DATE, EMPTIED_CARD_LOG_ID, [
    { id: 'emptied-card-row', weight: 135, reps: 5, count: 3 },
  ])

  const session = await signInAsBruno(page)

  const deletes: number[] = []
  page.on('request', (request) => {
    if (deleteOf(request, EMPTIED_CARD_LOG_ID)) deletes.push(EMPTIED_CARD_LOG_ID)
  })

  await expect(cardOf(page, exerciseId)).toBeVisible()
  await awaitMountPrefill(session)
  await awaitQuietCard(session, exerciseId, 1)

  // The set the lifter is about to erase has to be on screen first. It is this
  // pre-fill that hands the page the logId the delete runs on, so a card that never
  // received the saved set would have nothing to delete — and a journey that
  // started from such a card would be watching a no-op pass for a delete.
  await expectRowValues(page, exerciseId, 'Emptied Card', {
    count: '3',
    weight: '135',
    reps: '5',
  })
  expect(rowsFor(exerciseId, PAGE_LOCAL_DATE)).toHaveLength(1)

  // WEIGHT and REPS go first: the instant either stops being a number the row leaves
  // the collapse's reach, so no collapse rewrite lands on a field between two
  // clears. Nothing is asserted between them — a save armed by the first clear still
  // has the other two to wait for, and one 500ms window covers the burst.
  for (const field of ['weight', 'reps', 'count'] as const) {
    await inputOf(page, exerciseId, 'Emptied Card', field).fill('')
  }

  // The row is still there, blank: clearing a card is not removing a line, and the
  // page has to keep the line the lifter is standing on.
  await expect(rowIdsOf(page, exerciseId)).toHaveCount(1)
  await expectRowValues(page, exerciseId, 'Emptied Card', { count: '', weight: '', reps: '' })

  // The truth is in SQLite, not on the card: a page that saved an empty set list
  // would leave this card looking exactly as clean.
  await expect
    .poll(() => rowsFor(exerciseId, PAGE_LOCAL_DATE).length, {
      message:
        `the workout_logs row for exercise ${exerciseId} on ${PAGE_LOCAL_DATE} never ` +
        `went away — the emptied card saved an empty set list, or skipped the delete ` +
        `altogether and left the sets the lifter cleared sitting on their day`,
    })
    .toBe(0)

  expect(
    deletes,
    `the row is gone but deleteWorkoutAction(${BRUNO_USER_ID}, ${EMPTIED_CARD_LOG_ID}) ` +
      `was never sent, so something other than the page's emptied-card branch removed it`,
  ).toHaveLength(1)

  await expect(errorOf(page, exerciseId)).toHaveCount(0)
  await expect(cardOf(page, exerciseId).getByText('SAVING...', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(cardOf(page, exerciseId)).toBeVisible()
  await awaitPrefillAnswers(session, 2)

  await expect(rowIdsOf(page, exerciseId)).toHaveCount(1)
  await expectRowValues(page, exerciseId, 'Emptied Card', { count: '', weight: '', reps: '' })
  await expect(errorOf(page, exerciseId)).toHaveCount(0)

  expect(
    rowsFor(exerciseId, PAGE_LOCAL_DATE),
    'a row came back for the emptied card once the page re-read the day, so the ' +
      'delete only moved the row out of view instead of off the day',
  ).toHaveLength(0)
})
