export type TimerHandle = unknown

export type SaveSchedulerOptions<THandle = TimerHandle> = {
  delayMs: number
  setTimer: (callback: () => void, ms: number) => THandle
  clearTimer: (handle: THandle) => void
}

export type SaveScheduler<THandle = TimerHandle> = {
  schedule(exerciseId: number, run: () => void): void
  cancel(exerciseId: number): void
  flush(exerciseId: number): void
  flushAll(): void
  clearAll(): void
  hasPending(exerciseId: number): boolean
  pendingCount(): number
}

type PendingSave<THandle> = {
  handle: THandle
  run: () => void
}

/**
 * Owns the Today page's debounced saves: one timer per exercise id, a burst of
 * keystrokes producing exactly one save, and a flush that fires a pending save
 * now instead of discarding it.
 *
 * The timers arrive as parameters and this module holds no timer of its own, so
 * the whole rule set — the debounce, the per-exercise isolation, the flush —
 * is provable against a hand-rolled clock with no host and no render.
 *
 * Every entry is deleted before its callback runs. That is what lets a save
 * closure that schedules again re-arm cleanly rather than being wiped by a
 * later delete, and what makes a handle that fires after it was cleared a
 * no-op instead of a second save.
 */
export function createSaveScheduler<THandle = TimerHandle>({
  delayMs,
  setTimer,
  clearTimer,
}: SaveSchedulerOptions<THandle>): SaveScheduler<THandle> {
  const pending = new Map<number, PendingSave<THandle>>()

  function drop(exerciseId: number): PendingSave<THandle> | undefined {
    const entry = pending.get(exerciseId)
    if (!entry) return undefined

    pending.delete(exerciseId)
    clearTimer(entry.handle)
    return entry
  }

  function runNow(exerciseId: number): void {
    const entry = drop(exerciseId)
    if (!entry) return

    entry.run()
  }

  return {
    schedule(exerciseId: number, run: () => void): void {
      drop(exerciseId)

      let entry: PendingSave<THandle>
      const handle = setTimer(() => {
        if (pending.get(exerciseId) !== entry) return

        pending.delete(exerciseId)
        entry.run()
      }, delayMs)

      entry = { handle, run }
      pending.set(exerciseId, entry)
    },

    cancel(exerciseId: number): void {
      drop(exerciseId)
    },

    flush(exerciseId: number): void {
      runNow(exerciseId)
    },

    flushAll(): void {
      const failures: unknown[] = []

      for (const exerciseId of [...pending.keys()]) {
        try {
          runNow(exerciseId)
        } catch (error) {
          failures.push(error)
        }
      }

      // Every pending save gets its turn whether or not an earlier one threw,
      // and the first failure still reaches the caller — nothing here swallows.
      if (failures.length > 0) throw failures[0]
    },

    clearAll(): void {
      const entries = [...pending.values()]
      pending.clear()

      for (const entry of entries) {
        clearTimer(entry.handle)
      }
    },

    hasPending(exerciseId: number): boolean {
      return pending.has(exerciseId)
    },

    pendingCount(): number {
      return pending.size
    },
  }
}
