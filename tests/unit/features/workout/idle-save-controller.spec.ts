import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createIdleSaveController, IDLE_SAVE_MS } from '@/features/workout/idle-save-controller'

const realSetTimeout = globalThis.setTimeout

type SaveSpy = ReturnType<typeof vi.fn>

function makeController(
  overrides?: { save?: (exerciseId: number) => Promise<void>; waitMs?: number },
): { controller: ReturnType<typeof createIdleSaveController>; save: SaveSpy } {
  const save = overrides?.save ?? vi.fn().mockResolvedValue(undefined)
  const controller = createIdleSaveController({
    save,
    ...(overrides?.waitMs === undefined ? {} : { waitMs: overrides.waitMs }),
  })
  return { controller, save: save as SaveSpy }
}

function makeDeferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function drain(): Promise<void> {
  await new Promise<void>((resolve) => realSetTimeout(() => resolve(), 0))
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('IDLE_SAVE_MS', () => {
  it('is exactly 5000', () => {
    expect(IDLE_SAVE_MS).toBe(5000)
  })
})

describe('the wait window', () => {
  it.each([
    { label: 'default', waitMs: undefined, justBefore: 4999, expiry: 5000 },
    { label: 'overridden', waitMs: 1000, justBefore: 999, expiry: 1000 },
  ])(
    'saves at $expiry ms and not at $justBefore ms ($label waitMs)',
    ({ waitMs, justBefore, expiry }) => {
      const { controller, save } = makeController({ waitMs })

      controller.schedule(1)
      vi.advanceTimersByTime(justBefore)
      expect(save).not.toHaveBeenCalled()

      vi.advanceTimersByTime(expiry - justBefore)
      expect(save).toHaveBeenCalledTimes(1)
      expect(save).toHaveBeenCalledWith(1)
    },
  )
})

describe('one save per burst', () => {
  it('collapses five changes spaced across the window into a single save', () => {
    const { controller, save } = makeController()

    for (let i = 0; i < 5; i += 1) {
      controller.schedule(1)
      if (i < 4) vi.advanceTimersByTime(100)
    }
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)
  })

  it('collapses five changes in the same tick into a single save', () => {
    const { controller, save } = makeController()

    for (let i = 0; i < 5; i += 1) controller.schedule(1)
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves again when a second burst follows a completed one', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(5000)
    controller.schedule(1)
    vi.advanceTimersByTime(5000)

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(1, 1)
    expect(save).toHaveBeenNthCalledWith(2, 1)
  })
})

describe('restart from the last change', () => {
  it('pushes the save out by a full window from the most recent change', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(4000)
    controller.schedule(1)
    vi.advanceTimersByTime(4000)
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)
  })
})

describe('per-exercise independence', () => {
  it('lets exercise 1 expire on its own clock while exercise 2 is still waiting', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(2000)
    controller.schedule(2)
    vi.advanceTimersByTime(3000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)

    vi.advanceTimersByTime(2000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(2)
  })

  it('saves both exercises when both windows elapse together', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    vi.advanceTimersByTime(5000)

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenCalledWith(1)
    expect(save).toHaveBeenCalledWith(2)
  })

  it('arming a second exercise at the last millisecond neither cancels nor delays the first', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(4999)
    controller.schedule(2)
    vi.advanceTimersByTime(1)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)
    expect(controller.hasPending()).toBe(true)

    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(2)
  })

  it('leaves an unscheduled exercise idle while another is pending', () => {
    const { controller } = makeController()

    controller.schedule(1)

    expect(controller.getState(1)).toBe('pending')
    expect(controller.getState(2)).toBe('idle')
  })
})

describe('the save state machine', () => {
  it('reports idle for an exercise id that was never scheduled', () => {
    const { controller } = makeController()

    expect(controller.getState(7)).toBe('idle')
  })

  it('reports pending the moment an exercise is scheduled', () => {
    const { controller } = makeController()

    controller.schedule(1)

    expect(controller.getState(1)).toBe('pending')
  })

  it('is saving while the save promise is unsettled and idle once it settles', async () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(controller.getState(1)).toBe('saving')

    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getState(1)).toBe('idle')
  })

  it('reports error once a rejected save settles', async () => {
    const save = vi.fn().mockRejectedValue(new Error('save failed'))
    const { controller } = makeController({ save })

    controller.schedule(1)
    await vi.advanceTimersByTimeAsync(5000)

    expect(controller.getState(1)).toBe('error')
  })

  it('recovers from error on the next change and saves again', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('save failed')).mockResolvedValue(undefined)
    const { controller } = makeController({ save })

    controller.schedule(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(controller.getState(1)).toBe('error')

    controller.schedule(1)
    expect(controller.getState(1)).toBe('pending')

    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(controller.getState(1)).toBe('idle')
  })

  it('swallows a rejected save without an unhandled rejection', async () => {
    const rejections: unknown[] = []
    const onRejection = (reason: unknown): void => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onRejection)

    try {
      const save = vi.fn().mockRejectedValue(new Error('save failed'))
      const { controller } = makeController({ save })

      controller.schedule(1)
      vi.advanceTimersByTime(5000)
      await drain()

      expect(controller.getState(1)).toBe('error')
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})

describe('cancel', () => {
  it('clears a pending exercise so its window never expires', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.cancel(1)

    expect(controller.getState(1)).toBe('idle')
    expect(controller.hasPending()).toBe(false)

    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves an in-flight save alone and still lets it settle', async () => {
    const deferred = makeDeferred()
    const save = vi.fn().mockReturnValue(deferred.promise)
    const { controller } = makeController({ save })

    controller.schedule(1)
    vi.advanceTimersByTime(5000)
    expect(controller.getState(1)).toBe('saving')

    controller.cancel(1)
    expect(controller.getState(1)).toBe('saving')

    deferred.resolve()
    await drain()
    expect(controller.getState(1)).toBe('idle')
  })

  it('is a no-op for an exercise id that was never scheduled', () => {
    const { controller, save } = makeController()
    controller.schedule(2)

    expect(() => controller.cancel(99)).not.toThrow()

    expect(controller.getState(99)).toBe('idle')
    expect(controller.hasPending()).toBe(true)

    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(2)
  })
})

describe('flushAll', () => {
  it('saves every pending exercise immediately, without waiting out the window', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.flushAll()

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenCalledWith(1)
    expect(save).toHaveBeenCalledWith(2)
  })

  it('clears the timers it fired so nothing saves a second time', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.flushAll()
    expect(controller.hasPending()).toBe(false)

    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate a save already in flight', () => {
    const deferred = makeDeferred()
    const save = vi.fn().mockReturnValue(deferred.promise)
    const { controller } = makeController({ save })

    controller.schedule(1)
    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(1)

    controller.flushAll()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('is a no-op on a controller with nothing scheduled', () => {
    const { controller, save } = makeController()

    expect(() => controller.flushAll()).not.toThrow()
    expect(save).not.toHaveBeenCalled()
  })

  it('saves nothing on a second call', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.flushAll()
    controller.flushAll()

    expect(save).toHaveBeenCalledTimes(2)
  })

  it('skips an exercise that was cancelled before the flush', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.cancel(2)
    controller.flushAll()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)
  })

  it('still flushes the other exercise when one flushed save rejects, and swallows the rejection', async () => {
    const rejections: unknown[] = []
    const onRejection = (reason: unknown): void => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onRejection)

    try {
      const save = vi.fn((exerciseId: number) =>
        exerciseId === 1 ? Promise.reject(new Error('save failed')) : Promise.resolve(),
      )
      const { controller } = makeController({ save })

      controller.schedule(1)
      controller.schedule(2)
      controller.flushAll()

      expect(save).toHaveBeenCalledTimes(2)
      expect(save).toHaveBeenCalledWith(1)
      expect(save).toHaveBeenCalledWith(2)

      await drain()
      expect(controller.getState(1)).toBe('error')
      expect(controller.getState(2)).toBe('idle')
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })

  it('arms a fresh window for an exercise that was scheduled, flushed, then scheduled again', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.flushAll()
    controller.schedule(1)
    vi.advanceTimersByTime(4999)
    expect(save).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(2)
  })
})

describe('cancelAll', () => {
  it('clears every timer and leaves every exercise idle', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.cancelAll()

    expect(controller.hasPending()).toBe(false)
    expect(controller.getState(1)).toBe('idle')
    expect(controller.getState(2)).toBe('idle')

    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('leaves the controller reusable for a fresh schedule', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    controller.schedule(2)
    controller.cancelAll()

    controller.schedule(1)
    vi.advanceTimersByTime(5000)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(1)
  })
})

describe('hasPending', () => {
  it('is false on a fresh controller', () => {
    const { controller } = makeController()

    expect(controller.hasPending()).toBe(false)
  })

  it('is true while an exercise is waiting out its window', () => {
    const { controller } = makeController()

    controller.schedule(1)

    expect(controller.hasPending()).toBe(true)
  })

  it('is false once that exercise is cancelled', () => {
    const { controller } = makeController()

    controller.schedule(1)
    controller.cancel(1)

    expect(controller.hasPending()).toBe(false)
  })

  it('is false for an in-flight save whose timer has already fired', () => {
    const deferred = makeDeferred()
    const save = vi.fn().mockReturnValue(deferred.promise)
    const { controller } = makeController({ save })

    controller.schedule(1)
    vi.advanceTimersByTime(5000)

    expect(controller.getState(1)).toBe('saving')
    expect(controller.hasPending()).toBe(false)
  })
})

describe('the save callback contract', () => {
  it('calls save with exactly one argument, the exercise id number', () => {
    const { controller, save } = makeController()

    controller.schedule(1)
    vi.advanceTimersByTime(5000)

    expect(save.mock.calls).toEqual([[1]])
  })
})
