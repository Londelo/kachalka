export type SaveState = 'idle' | 'pending' | 'saving' | 'error'

export type IdleSaveController = {
  schedule(exerciseId: number): void
  cancel(exerciseId: number): void
  cancelAll(): void
  flush(exerciseId: number): void
  flushAll(): void
  getState(exerciseId: number): SaveState
  hasPending(): boolean
}

export const IDLE_SAVE_MS = 5000

export function createIdleSaveController({
  save,
  waitMs = IDLE_SAVE_MS,
  setTimer = (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimer = (handle: unknown) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
}: {
  save: (exerciseId: number) => Promise<void>
  waitMs?: number
  setTimer?: (cb: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}): IdleSaveController {
  const timers = new Map<number, unknown>()
  const states = new Map<number, SaveState>()

  const runSave = (exerciseId: number): void => {
    const settle = (): void => {
      states.set(exerciseId, 'idle')
    }
    const fail = (): void => {
      states.set(exerciseId, 'error')
    }

    try {
      Promise.resolve(save(exerciseId)).then(settle, fail)
    } catch {
      fail()
    }
  }

  const clearTimerFor = (exerciseId: number): void => {
    if (!timers.has(exerciseId)) return
    clearTimer(timers.get(exerciseId))
    timers.delete(exerciseId)
  }

  /**
   * The one way a waiting window turns into a save: only an exercise with a live
   * timer is settled, so an exercise that already fired, or was cancelled, or was
   * never scheduled is left alone and never saved twice.
   */
  const settleTimerFor = (exerciseId: number): void => {
    if (!timers.has(exerciseId)) return
    clearTimerFor(exerciseId)
    states.set(exerciseId, 'saving')
    runSave(exerciseId)
  }

  return {
    schedule(exerciseId: number): void {
      clearTimerFor(exerciseId)
      states.set(exerciseId, 'pending')

      const handle = setTimer(() => {
        timers.delete(exerciseId)
        states.set(exerciseId, 'saving')
        runSave(exerciseId)
      }, waitMs)

      timers.set(exerciseId, handle)
    },

    cancel(exerciseId: number): void {
      clearTimerFor(exerciseId)
      if (!states.has(exerciseId)) return
      if (states.get(exerciseId) !== 'saving') states.set(exerciseId, 'idle')
    },

    cancelAll(): void {
      for (const [exerciseId, handle] of [...timers]) {
        clearTimer(handle)
        timers.delete(exerciseId)
      }
      for (const [exerciseId, state] of [...states]) {
        if (state !== 'saving') states.set(exerciseId, 'idle')
      }
    },

    /**
     * Settle one exercise's waiting window now, synchronously, before the caller
     * changes state the save reads back. Use this when a single card is about to
     * lose its data — the save reads that data while this call is still on the stack.
     */
    flush(exerciseId: number): void {
      settleTimerFor(exerciseId)
    },

    flushAll(): void {
      for (const exerciseId of [...timers.keys()]) {
        settleTimerFor(exerciseId)
      }
    },

    getState(exerciseId: number): SaveState {
      return states.get(exerciseId) ?? 'idle'
    },

    hasPending(): boolean {
      return timers.size > 0
    },
  }
}
