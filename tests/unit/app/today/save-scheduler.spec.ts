import { describe, it, expect, vi } from 'vitest'
import { createSaveScheduler } from '@/app/today/save-scheduler'

type ArmedTimer = {
  callback: () => void
  ms: number
}

type FakeClock = {
  setTimer: (callback: () => void, ms: number) => number
  clearTimer: (handle: number) => void
  fire: (token: number) => void
  tokens: () => number[]
  msFor: (token: number) => number
  clearedHandles: () => number[]
  liveCount: () => number
}

// Every timer ever armed stays addressable, and `clearTimer` only marks it dead.
// That is deliberate: a test can fire a handle the scheduler already cleared and
// prove the cleared handle is a no-op rather than a second save.
const makeClock = (): FakeClock => {
  const armed = new Map<number, ArmedTimer>()
  const live = new Set<number>()
  const cleared: number[] = []
  let nextToken = 1

  const setTimer = vi.fn((callback: () => void, ms: number) => {
    const token = nextToken
    nextToken += 1
    armed.set(token, { callback, ms })
    live.add(token)
    return token
  })

  const clearTimer = vi.fn((handle: number) => {
    live.delete(handle)
    cleared.push(handle)
  })

  const entryFor = (token: number): ArmedTimer => {
    const entry = armed.get(token)
    if (!entry) throw new Error(`no timer was ever armed with token ${token}`)
    return entry
  }

  return {
    setTimer,
    clearTimer,
    fire: token => {
      const entry = entryFor(token)
      live.delete(token)
      entry.callback()
    },
    tokens: () => [...armed.keys()],
    msFor: token => entryFor(token).ms,
    clearedHandles: () => [...cleared],
    liveCount: () => live.size,
  }
}

const makeScheduler = (delayMs = 500) => {
  const clock = makeClock()
  const scheduler = createSaveScheduler<number>({
    delayMs,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })
  return { scheduler, clock }
}

const tokenAt = (clock: FakeClock, index: number): number => {
  const tokens = clock.tokens()
  expect(tokens.length).toBeGreaterThan(index)
  return tokens[index]
}

describe('createSaveScheduler', () => {
  describe('scheduling and firing', () => {
    it('arms a timer without running the save', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)

      expect(run).not.toHaveBeenCalled()
      expect(scheduler.hasPending(1)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)
      expect(clock.setTimer).toHaveBeenCalledTimes(1)
      expect(clock.liveCount()).toBe(1)
    })

    it('runs the save exactly once when that exercise timer fires', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)
      clock.fire(tokenAt(clock, 0))

      expect(run).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.liveCount()).toBe(0)
    })

    it('deletes the entry before the callback runs', () => {
      const { scheduler, clock } = makeScheduler()
      const observed: Array<boolean | number> = []
      const run = vi.fn(() => {
        observed.push(scheduler.hasPending(1), scheduler.pendingCount())
      })

      scheduler.schedule(1, run)
      clock.fire(tokenAt(clock, 0))

      expect(observed).toEqual([false, 0])
    })

    it('collapses a burst on one exercise into a single save', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)
      scheduler.schedule(1, run)
      scheduler.schedule(1, run)
      clock.fire(tokenAt(clock, 0))
      clock.fire(tokenAt(clock, 1))
      clock.fire(tokenAt(clock, 2))

      expect(run).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.liveCount()).toBe(0)
    })

    it('keeps the latest closure when the same exercise is scheduled twice', () => {
      const { scheduler, clock } = makeScheduler()
      const earlier = vi.fn()
      const later = vi.fn()

      scheduler.schedule(1, earlier)
      scheduler.schedule(1, later)
      clock.fire(tokenAt(clock, 1))

      expect(later).toHaveBeenCalledTimes(1)
      expect(earlier).not.toHaveBeenCalled()
    })

    it('clears the earlier handle when the same exercise is re-scheduled', () => {
      const { scheduler, clock } = makeScheduler()

      scheduler.schedule(1, vi.fn())
      scheduler.schedule(1, vi.fn())

      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 0)])
      expect(clock.clearTimer).toHaveBeenCalledTimes(1)
      expect(clock.liveCount()).toBe(1)
    })

    it('ignores a superseded handle that fires after the replacement', () => {
      const { scheduler, clock } = makeScheduler()
      const earlier = vi.fn()
      const later = vi.fn()

      scheduler.schedule(1, earlier)
      scheduler.schedule(1, later)

      clock.fire(tokenAt(clock, 0))

      expect(earlier).not.toHaveBeenCalled()
      expect(later).not.toHaveBeenCalled()
      expect(scheduler.hasPending(1)).toBe(true)

      clock.fire(tokenAt(clock, 1))

      expect(later).toHaveBeenCalledTimes(1)
    })

    it('lets a save that re-schedules itself arm cleanly', () => {
      const { scheduler, clock } = makeScheduler()
      const second = vi.fn()
      const first = vi.fn(() => {
        scheduler.schedule(1, second)
      })

      scheduler.schedule(1, first)
      clock.fire(tokenAt(clock, 0))

      expect(first).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)

      clock.fire(tokenAt(clock, 1))

      expect(second).toHaveBeenCalledTimes(1)
    })

    it('treats exercise id 0 as an ordinary key', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(0, run)

      expect(scheduler.hasPending(0)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)

      clock.fire(tokenAt(clock, 0))

      expect(run).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(0)).toBe(false)
    })

    it('reports no pending save for an exercise that was never scheduled', () => {
      const { scheduler } = makeScheduler()

      expect(scheduler.hasPending(99)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
    })
  })

  describe('per-exercise isolation', () => {
    it('fires only the exercise whose timer fired', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      clock.fire(tokenAt(clock, 0))

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).not.toHaveBeenCalled()
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.hasPending(2)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)

      clock.fire(tokenAt(clock, 1))

      expect(saveB).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('never cancels one exercise while another is re-scheduled repeatedly', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.schedule(2, saveB)
      scheduler.schedule(2, saveB)
      clock.fire(tokenAt(clock, 0))

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).not.toHaveBeenCalled()
      expect(scheduler.hasPending(2)).toBe(true)
      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 1), tokenAt(clock, 2)])
    })

    it('keeps the other exercise pending when one is cancelled', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.cancel(1)
      clock.fire(tokenAt(clock, 1))

      expect(saveA).not.toHaveBeenCalled()
      expect(saveB).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('flushes one exercise without touching the other', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.flush(1)

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).not.toHaveBeenCalled()
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.hasPending(2)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)

      clock.fire(tokenAt(clock, 1))

      expect(saveB).toHaveBeenCalledTimes(1)
    })
  })

  describe('flush', () => {
    it('runs a pending save synchronously and clears it', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)
      scheduler.flush(1)

      expect(run).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 0)])
    })

    it('does not run a save twice when the cleared handle fires after a flush', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)
      scheduler.flush(1)
      clock.fire(tokenAt(clock, 0))

      expect(run).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('does nothing and throws nothing when the exercise has no pending save', () => {
      const { scheduler, clock } = makeScheduler()

      expect(() => scheduler.flush(1)).not.toThrow()
      expect(clock.setTimer).not.toHaveBeenCalled()
      expect(clock.clearTimer).not.toHaveBeenCalled()
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('does nothing when a different exercise holds the only pending save', () => {
      const { scheduler, clock } = makeScheduler()
      const saveB = vi.fn()

      scheduler.schedule(2, saveB)
      scheduler.flush(1)

      expect(saveB).not.toHaveBeenCalled()
      expect(scheduler.hasPending(2)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)
      expect(clock.clearTimer).not.toHaveBeenCalled()
    })

    it('re-arms after a flush and flushes the new closure', () => {
      const { scheduler, clock } = makeScheduler()
      const first = vi.fn()
      const second = vi.fn()

      scheduler.schedule(1, first)
      scheduler.flush(1)
      scheduler.schedule(1, second)
      scheduler.flush(1)

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.liveCount()).toBe(0)
    })
  })

  describe('flushAll', () => {
    it('runs every pending save exactly once', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.flushAll()

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.hasPending(2)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 0), tokenAt(clock, 1)])
    })

    it('collapses a burst before flushing, so one exercise saves once', () => {
      const { scheduler } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.flushAll()

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('throws nothing and calls nothing when nothing is pending', () => {
      const { scheduler, clock } = makeScheduler()

      expect(() => scheduler.flushAll()).not.toThrow()
      expect(clock.setTimer).not.toHaveBeenCalled()
      expect(clock.clearTimer).not.toHaveBeenCalled()
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('runs the other saves and leaves nothing pending when one save throws', () => {
      const { scheduler, clock } = makeScheduler()
      const saveB = vi.fn()
      const throwing = vi.fn(() => {
        throw new Error('boom')
      })

      scheduler.schedule(1, throwing)
      scheduler.schedule(2, saveB)

      expect(() => scheduler.flushAll()).toThrow('boom')

      expect(throwing).toHaveBeenCalledTimes(1)
      expect(saveB).toHaveBeenCalledTimes(1)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.hasPending(2)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.liveCount()).toBe(0)
    })

    it('attempts every save when more than one throws and rethrows the first failure', () => {
      const { scheduler } = makeScheduler()
      const first = vi.fn(() => {
        throw new Error('first-boom')
      })
      const second = vi.fn(() => {
        throw new Error('second-boom')
      })

      scheduler.schedule(1, first)
      scheduler.schedule(2, second)

      expect(() => scheduler.flushAll()).toThrow('first-boom')

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('flushes only what was pending when it was called, not a save scheduled mid-flush', () => {
      const { scheduler } = makeScheduler()
      const late = vi.fn()
      const first = vi.fn(() => {
        scheduler.schedule(2, late)
      })

      scheduler.schedule(1, first)
      scheduler.flushAll()

      expect(first).toHaveBeenCalledTimes(1)
      expect(late).not.toHaveBeenCalled()
      expect(scheduler.hasPending(2)).toBe(true)
      expect(scheduler.pendingCount()).toBe(1)
    })

    it('does not run a flushed save again when its cleared handle fires', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.flushAll()
      clock.fire(tokenAt(clock, 0))
      clock.fire(tokenAt(clock, 1))

      expect(saveA).toHaveBeenCalledTimes(1)
      expect(saveB).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancel and clearAll', () => {
    it('drops a pending save without running it', () => {
      const { scheduler, clock } = makeScheduler()
      const run = vi.fn()

      scheduler.schedule(1, run)
      scheduler.cancel(1)

      expect(run).not.toHaveBeenCalled()
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.pendingCount()).toBe(0)
      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 0)])

      clock.fire(tokenAt(clock, 0))

      expect(run).not.toHaveBeenCalled()
    })

    it('throws nothing when cancelling an exercise that was never scheduled', () => {
      const { scheduler, clock } = makeScheduler()

      expect(() => scheduler.cancel(7)).not.toThrow()
      expect(clock.clearTimer).not.toHaveBeenCalled()
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('drops every pending save without running any of them', () => {
      const { scheduler, clock } = makeScheduler()
      const saveA = vi.fn()
      const saveB = vi.fn()

      scheduler.schedule(1, saveA)
      scheduler.schedule(2, saveB)
      scheduler.clearAll()

      expect(saveA).not.toHaveBeenCalled()
      expect(saveB).not.toHaveBeenCalled()
      expect(scheduler.pendingCount()).toBe(0)
      expect(scheduler.hasPending(1)).toBe(false)
      expect(scheduler.hasPending(2)).toBe(false)
      expect(clock.clearedHandles()).toEqual([tokenAt(clock, 0), tokenAt(clock, 1)])
      expect(clock.liveCount()).toBe(0)

      clock.fire(tokenAt(clock, 0))
      clock.fire(tokenAt(clock, 1))

      expect(saveA).not.toHaveBeenCalled()
      expect(saveB).not.toHaveBeenCalled()
    })

    it('throws nothing when clearing with nothing pending', () => {
      const { scheduler, clock } = makeScheduler()

      expect(() => scheduler.clearAll()).not.toThrow()
      expect(clock.clearTimer).not.toHaveBeenCalled()
      expect(scheduler.pendingCount()).toBe(0)
    })

    it('leaves a fresh schedule untouched by an earlier clearAll', () => {
      const { scheduler, clock } = makeScheduler()
      const discarded = vi.fn()
      const kept = vi.fn()

      scheduler.schedule(1, discarded)
      scheduler.clearAll()
      scheduler.schedule(1, kept)
      scheduler.clearAll()
      scheduler.schedule(1, kept)
      clock.fire(tokenAt(clock, clock.tokens().length - 1))

      expect(discarded).not.toHaveBeenCalled()
      expect(kept).toHaveBeenCalledTimes(1)
    })
  })

  describe('delayMs', () => {
    it.each([0, 1, 250, 500, 60_000])('forwards delayMs %i to setTimer', delayMs => {
      const { scheduler, clock } = makeScheduler(delayMs)

      scheduler.schedule(1, vi.fn())

      expect(clock.setTimer).toHaveBeenCalledTimes(1)
      expect(clock.setTimer).toHaveBeenCalledWith(expect.any(Function), delayMs)
      expect(clock.msFor(tokenAt(clock, 0))).toBe(delayMs)
    })

    it('arms a re-schedule with the same delay', () => {
      const { scheduler, clock } = makeScheduler(500)

      scheduler.schedule(1, vi.fn())
      scheduler.schedule(1, vi.fn())
      scheduler.schedule(2, vi.fn())

      expect(clock.msFor(tokenAt(clock, 0))).toBe(500)
      expect(clock.msFor(tokenAt(clock, 1))).toBe(500)
      expect(clock.msFor(tokenAt(clock, 2))).toBe(500)
    })
  })
})
