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
  onStateChange,
  setTimer = (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimer = (handle: unknown) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
}: {
  save: (exerciseId: number) => Promise<void>
  waitMs?: number
  /**
   * Called with the state just written, after every state write this controller makes.
   * A reader that mirrors these states is told when one changes instead of guessing when
   * the controller is done: the write and the notification are one step, so nothing on
   * the reading side has to count microtask turns between this file's `settle`/`fail`
   * and whatever it reads back. Optional — `getState` remains the pull for a reader that
   * has no live interest in the states.
   */
  onStateChange?: (exerciseId: number, state: SaveState) => void
  setTimer?: (cb: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}): IdleSaveController {
  const timers = new Map<number, unknown>()
  const states = new Map<number, SaveState>()
  /**
   * One generation per exercise, advanced every time the controller opens a new
   * window (schedule) or dispatches a new save. A save in flight carries the
   * generation it was dispatched under, so when it lands it can tell whether the
   * state it is about to write is still the state it left behind — a later
   * schedule, or a later save, retires it and its result is dropped on the floor.
   */
  const generations = new Map<number, number>()

  const advanceGenerationFor = (exerciseId: number): number => {
    const generation = (generations.get(exerciseId) ?? 0) + 1
    generations.set(exerciseId, generation)
    return generation
  }

  const isCurrentGeneration = (exerciseId: number, generation: number): boolean =>
    generations.get(exerciseId) === generation

  /**
   * The one way a state changes: the map write and the listener call are never apart,
   * so a mirror can never be reading a state nobody has been told about yet. Every
   * `states.set` below goes through here — a write that skips it is a write a reader
   * is left to discover by polling.
   */
  const writeState = (exerciseId: number, state: SaveState): void => {
    states.set(exerciseId, state)
    onStateChange?.(exerciseId, state)
  }

  const runSave = (exerciseId: number, generation: number): void => {
    const settle = (): void => {
      if (!isCurrentGeneration(exerciseId, generation)) return
      writeState(exerciseId, 'idle')
    }
    const fail = (): void => {
      if (!isCurrentGeneration(exerciseId, generation)) return
      writeState(exerciseId, 'error')
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
    writeState(exerciseId, 'saving')
    runSave(exerciseId, advanceGenerationFor(exerciseId))
  }

  return {
    schedule(exerciseId: number): void {
      clearTimerFor(exerciseId)
      // A new window retires any save still in flight for this exercise: whatever
      // it returns describes sets this edit has already superseded.
      advanceGenerationFor(exerciseId)
      writeState(exerciseId, 'pending')

      const handle = setTimer(() => {
        timers.delete(exerciseId)
        writeState(exerciseId, 'saving')
        runSave(exerciseId, advanceGenerationFor(exerciseId))
      }, waitMs)

      timers.set(exerciseId, handle)
    },

    cancel(exerciseId: number): void {
      clearTimerFor(exerciseId)
      if (!states.has(exerciseId)) return
      if (states.get(exerciseId) !== 'saving') writeState(exerciseId, 'idle')
    },

    cancelAll(): void {
      for (const [exerciseId, handle] of [...timers]) {
        clearTimer(handle)
        timers.delete(exerciseId)
      }
      for (const [exerciseId, state] of [...states]) {
        if (state !== 'saving') writeState(exerciseId, 'idle')
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
