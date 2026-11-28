import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import TodayPage from '@/app/today/page'

const USER_ID = 7
const EXERCISE_ID = 42
const EXERCISE_NAME = 'SQUAT'

// The rule the epic brief states outright, written down as the number the page
// has to hand its save scheduler: one write per typing burst, five quiet
// seconds after the LAST change. The scheduler's own spec drives the scheduler
// with delayMs values of its own choosing, so it stays green whatever the page
// supplies; only the page, rendered, can prove which number it actually gives.
const CONTRACT_WINDOW_MS = 5000

const mocks = vi.hoisted(() => ({
  logWorkoutAction: vi.fn(),
  getTodayExercisesAction: vi.fn(),
  getTodayWorkoutsAction: vi.fn(),
  deleteWorkoutAction: vi.fn(),
  start: vi.fn(),
  end: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/features/workout/workout-server-actions', () => ({
  logWorkoutAction: mocks.logWorkoutAction,
  getTodayExercisesAction: mocks.getTodayExercisesAction,
  getTodayWorkoutsAction: mocks.getTodayWorkoutsAction,
  deleteWorkoutAction: mocks.deleteWorkoutAction,
}))

vi.mock('@/components/loading-context', () => ({
  useLoading: () => ({ pages: new Set<string>(), start: mocks.start, end: mocks.end }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
}))

function fieldOf(label: string): HTMLElement {
  return screen.getByRole('textbox', { name: label })
}

function typeInto(label: string, value: string): void {
  fireEvent.change(fieldOf(label), { target: { value } })
}

function typeBurst(): void {
  typeInto(`Weight in pounds for ${EXERCISE_NAME}`, '225')
  typeInto(`Reps for ${EXERCISE_NAME}`, '8')
  typeInto(`Set count for ${EXERCISE_NAME}`, '3')
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function openTodayPage(): Promise<void> {
  document.cookie = `kachalka.userId=${USER_ID}`

  await act(async () => {
    render(createElement(TodayPage))
  })
  await advance(0)

  expect(fieldOf(`Set count for ${EXERCISE_NAME}`)).toBeTruthy()
}

function writtenSets(): Record<string, unknown>[] {
  const calls = mocks.logWorkoutAction.mock.calls
  if (calls.length === 0) return []
  return calls[0][3] as Record<string, unknown>[]
}

describe('Today page save window', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.logWorkoutAction.mockResolvedValue({ success: true, log: { id: 1 } })
    mocks.getTodayExercisesAction.mockResolvedValue({
      success: true,
      exercises: [{ exerciseId: EXERCISE_ID, exerciseName: EXERCISE_NAME, lastLog: null }],
    })
    mocks.getTodayWorkoutsAction.mockResolvedValue({ success: true, workouts: {}, logIds: {} })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('writes nothing until the five quiet seconds have passed, then writes the burst exactly once', async () => {
    await openTodayPage()
    typeBurst()

    await advance(CONTRACT_WINDOW_MS - 1)

    expect(mocks.logWorkoutAction).not.toHaveBeenCalled()

    await advance(1)

    expect(mocks.logWorkoutAction).toHaveBeenCalledTimes(1)
    const [userId, exerciseId] = mocks.logWorkoutAction.mock.calls[0]
    expect(userId).toBe(USER_ID)
    expect(exerciseId).toBe(EXERCISE_ID)
    expect(writtenSets()).toHaveLength(1)
    expect(writtenSets()[0]).toMatchObject({ weight: 225, reps: 8, count: 3 })
  })

  it('measures the window from the last change of the burst, not the first', async () => {
    await openTodayPage()

    typeInto(`Weight in pounds for ${EXERCISE_NAME}`, '225')
    await advance(4_000)
    typeInto(`Reps for ${EXERCISE_NAME}`, '8')

    await advance(CONTRACT_WINDOW_MS - 1)

    expect(mocks.logWorkoutAction).not.toHaveBeenCalled()

    await advance(1)

    expect(mocks.logWorkoutAction).toHaveBeenCalledTimes(1)
    expect(writtenSets()[0]).toMatchObject({ weight: 225, reps: 8 })
  })
})
