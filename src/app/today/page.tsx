'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { logWorkoutAction, getTodayWorkoutsAction, getTodayExercisesAction } from '@/features/workout/workout-server-actions'
import { useLoading } from '@/components/loading-context'
import type { WorkoutSet } from '@/features/workout/types'
import {
  createIdleSaveController,
  IDLE_SAVE_MS,
  type IdleSaveController,
  type SaveState,
} from '@/features/workout/idle-save-controller'
import { jsDayToAppIndex, getTodayISO } from '@/shared/utils/date'

type ExerciseItem = {
  exerciseId: number
  exerciseName: string
  lastLog?: { weight: number; reps: number }[] | null
}

type ViewMode = 'past' | 'current'

function generateId(): string {
  return crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16)
}

/**
 * EMPTY-MEANS-ONE — the one place the SET box's blank rule is written down.
 * Everything below, and the count input in the editable row, obeys this; nothing
 * else restates it.
 *
 * A blank SET box means ONE set.
 *
 * The box is controlled (`value={set.count ?? ''}`) and `parseCount` maps `''` and
 * `NaN` to `undefined`, so clearing it puts `undefined` in state and `undefined` in
 * the save payload. `normalizeSetCount` (src/features/workout/workout-entity.ts) is
 * the write-side rule that turns `undefined` — and `0` — into the stored `1`.
 *
 * Consequence, and it is deliberate: screen and store disagree while the user is
 * mid-edit. The commander sees an empty box while the saved record says one set.
 * A reload re-reads the line through the today-workouts projection, which decodes
 * the stored `1`, and the box then shows `1`.
 *
 * Do NOT "fix" the disagreement by rendering `set.count ?? 1`. That makes the box
 * impossible to clear, which is the behaviour the feature gate's acceptance criteria
 * and tests/e2e/today-set-count.spec.ts both pin. Keep the display empty and keep
 * `placeholder` showing the number the blank stands for.
 */
const EMPTY_COUNT_MEANS = 1
const EMPTY_COUNT_PLACEHOLDER = String(EMPTY_COUNT_MEANS)

function defaultSet(): WorkoutSet {
  return { id: generateId(), count: EMPTY_COUNT_MEANS, reps: 1, weight: 0 }
}

/** Blank and junk both read as "no number typed" — see EMPTY_COUNT_MEANS for what that means. */
function parseCount(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function getStoredUserId(): number | null {
  const match = document.cookie.match(/kachalka\.userId=(\d+)/)
  return match ? Number(match[1]) : null
}

type ExerciseCardProps = {
  exercise: ExerciseItem
  viewMode: ViewMode
  sets: WorkoutSet[]
  saveState: SaveState
  error: string | null
  onToggleView: () => void
  onAddSet: () => void
  onRemoveSet: (index: number) => void
  onSetChange: (index: number, field: keyof WorkoutSet, value: string) => void
}

function saveStateMarkerText(state: SaveState): string {
  if (state === 'pending') return 'PENDING...'
  if (state === 'saving') return 'SAVING...'
  return ''
}

function ExerciseCard({
  exercise,
  viewMode,
  sets,
  saveState,
  error,
  onToggleView,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: ExerciseCardProps) {
  return (
    <div
      className="border-4 border-on-surface bg-tertiary-fixed p-6"
      data-id={`exercise-card-${exercise.exerciseId}`}
    >
      {/* Header: exercise name + VIEWING PAST badge + toggle button */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-headline-md text-headline-md uppercase text-on-surface">
            {exercise.exerciseName}
          </h2>
          <p className="font-label-mono text-label-mono text-secondary">EXERCISE</p>
        </div>
        {viewMode === 'past' && (
          <span className="mr-2 font-headline-md text-headline-md uppercase text-secondary">
            VIEWING LAST SESSION
          </span>
        )}
        <button
          type="button"
          onClick={onToggleView}
          className={`border-4 border-on-surface bg-surface-container-low p-2 font-label-mono text-label-mono uppercase ${viewMode === 'past' ? '' : 'neo-shadow'}`}
          data-id={`toggle-view-${exercise.exerciseId}`}
        >
          {viewMode === 'past' ? 'CURRENT SESSION' : 'PAST SESSION'}
        </button>
      </div>

      {/* Past session view — read-only */}
      {viewMode === 'past' && exercise.lastLog && exercise.lastLog.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {exercise.lastLog.map((s, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
                <span className="font-label-mono text-label-mono text-secondary">SET:</span>
                <span className="font-body-md text-body-md text-on-surface">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
                <span className="font-label-mono text-label-mono text-secondary">LB:</span>
                <span className="font-body-md text-body-md text-on-surface">{s.weight}</span>
              </div>
              <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
                <span className="font-label-mono text-label-mono text-secondary">REPS:</span>
                <span className="font-body-md text-body-md text-on-surface">{s.reps}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past session — no previous data */}
      {viewMode === 'past' && (!exercise.lastLog || exercise.lastLog.length === 0) && (
        <div className="mb-4 border-b-4 border-dashed border-on-surface pb-4">
          <p className="font-label-mono text-label-mono text-secondary">
            NO PREVIOUS SESSIONS
          </p>
        </div>
      )}

      {/* Current session view — editable */}
      {viewMode === 'current' && (
        <>
          {sets.length > 0 && (
            <div className="mb-4 flex flex-col gap-4">
              {sets.map((set, index) => (
                <div key={set.id} className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">SET:</span>
                    <input
                      type="number"
                      value={set.count ?? ''}
                      onChange={(e) => onSetChange(index, 'count', e.target.value)}
                      placeholder={EMPTY_COUNT_PLACEHOLDER}
                      min="1"
                      step="1"
                      inputMode="numeric"
                      data-id={`set-count-input-${exercise.exerciseId}-${index}`}
                      aria-label={`Set count for set ${index + 1}`}
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">LB:</span>
                    <input
                      type="number"
                      value={set.weight || ''}
                      onChange={(e) => onSetChange(index, 'weight', e.target.value)}
                      placeholder="0"
                      data-id={`set-weight-input-${exercise.exerciseId}-${index}`}
                      aria-label={`Weight in pounds for set ${index + 1}`}
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">REPS:</span>
                    <input
                      type="number"
                      value={set.reps || ''}
                      onChange={(e) => onSetChange(index, 'reps', e.target.value)}
                      placeholder="0"
                      data-id={`set-reps-input-${exercise.exerciseId}-${index}`}
                      aria-label={`Reps for set ${index + 1}`}
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveSet(index)}
                    className="flex size-8 shrink-0 items-center justify-center border-b-4 border-on-surface bg-error p-1 text-on-primary neo-shadow transition-all active-press"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onAddSet}
            className="mb-4 w-full border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
          >
            ADD A SET
          </button>
        </>
      )}

      {saveState !== 'idle' && (
        <p
          className="font-label-mono text-label-mono text-secondary"
          role="status"
          aria-live="polite"
          data-id={`save-state-${exercise.exerciseId}`}
          data-save-state={saveState}
        >
          {saveStateMarkerText(saveState)}
        </p>
      )}

      {error && (
        <p
          className="mt-2 font-label-bold text-label-bold text-error"
          role="alert"
          data-id={`save-error-${exercise.exerciseId}`}
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default function TodayPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [loading, setLoading] = useState(true)

  const [viewModes, setViewModes] = useState<Map<number, ViewMode>>(new Map())
  const [exerciseSets, setExerciseSets] = useState<Map<number, WorkoutSet[]>>(new Map())
  const [saveStates, setSaveStates] = useState<Map<number, SaveState>>(new Map())
  const [errors, setErrors] = useState<Map<number, string>>(new Map())
  const exerciseSetsRef = useRef<Map<number, WorkoutSet[]>>(new Map())
  exerciseSetsRef.current = exerciseSets
  const exercisesRef = useRef<ExerciseItem[]>([])
  exercisesRef.current = exercises
  const mountedRef = useRef(true)
  const controllerRef = useRef<IdleSaveController | null>(null)

  const { start, end } = useLoading()

  function syncSaveStates(): void {
    if (!mountedRef.current) return
    const controller = controllerRef.current
    if (!controller) return

    const next = new Map<number, SaveState>()
    for (const exercise of exercisesRef.current) {
      next.set(exercise.exerciseId, controller.getState(exercise.exerciseId))
    }
    setSaveStates(next)
  }

  // The controller flips an exercise out of 'saving' in the microtask after the
  // save promise settles, so the mirror is read back one turn later than now.
  function syncSaveStatesAfterControllerSettles(): void {
    Promise.resolve().then(syncSaveStates).then(syncSaveStates).catch(() => {})
  }

  function setError(exerciseId: number, message: string): void {
    if (!mountedRef.current) return
    setErrors((prev) => {
      const next = new Map(prev)
      next.set(exerciseId, message)
      return next
    })
  }

  function clearError(exerciseId: number): void {
    if (!mountedRef.current) return
    setErrors((prev) => {
      if (!prev.has(exerciseId)) return prev
      const next = new Map(prev)
      next.delete(exerciseId)
      return next
    })
  }

  async function saveExercise(exerciseId: number): Promise<void> {
    try {
      const userId = getStoredUserId()
      if (!userId) return

      const sets = exerciseSetsRef.current.get(exerciseId)
      if (!sets) return

      const validSets = sets.filter((s) => s.weight !== 0 || s.reps !== 0)
      if (validSets.length === 0) return

      syncSaveStates()

      const today = getTodayISO()
      const res = await logWorkoutAction(userId, exerciseId, today, validSets)

      if (!res.success) {
        const message = res.error ?? 'Failed to save workout'
        setError(exerciseId, message)
        throw new Error(message)
      }

      const dayOfWeek = jsDayToAppIndex(new Date().getDay())
      const exRes = await getTodayExercisesAction(userId, dayOfWeek)
      if (mountedRef.current && exRes.success && exRes.exercises) {
        setExercises(exRes.exercises)
      }
    } finally {
      syncSaveStatesAfterControllerSettles()
    }
  }

  if (!controllerRef.current) {
    controllerRef.current = createIdleSaveController({ save: saveExercise, waitMs: IDLE_SAVE_MS })
  }

  // Load exercises on mount
  useEffect(() => {
    start('today')
    const userId = getStoredUserId()
    if (!userId) {
      end('today')
      router.push('/')
      return
    }
    const dayOfWeek = jsDayToAppIndex(new Date().getDay())
    getTodayExercisesAction(userId, dayOfWeek).then((res) => {
      if (res.success && res.exercises) {
        setExercises(res.exercises)

        // Pre-fill current session from today's saved data
        getTodayWorkoutsAction(userId).then((workoutsRes) => {
          if (workoutsRes.success && workoutsRes.workouts) {
            const nextSets = new Map<number, WorkoutSet[]>()
            const nextModes = new Map<number, ViewMode>()
            for (const exercise of res.exercises ?? []) {
              const sets = workoutsRes.workouts[exercise.exerciseId]
              if (sets) {
                nextSets.set(exercise.exerciseId, sets.map(s => ({ id: generateId(), ...s })))
              }
              nextModes.set(exercise.exerciseId, 'current')
            }
            setExerciseSets(nextSets)
            setViewModes(nextModes)
          } else {
            // No workouts today — set view modes to 'current'
            const nextModes = new Map<number, ViewMode>()
            for (const exercise of res.exercises ?? []) {
              nextModes.set(exercise.exerciseId, 'current')
            }
            setViewModes(nextModes)
          }
        })
      }
      setLoading(false)
      end('today')
    })
    return () => {
      end('today')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.flushAll()
    }
  }, [])

  function getSets(exerciseId: number): WorkoutSet[] {
    const existing = exerciseSets.get(exerciseId)
    return existing ?? [defaultSet()]
  }

  function updateSets(exerciseId: number, updater: (prev: WorkoutSet[]) => WorkoutSet[]): void {
    setExerciseSets((prev) => {
      const current = prev.get(exerciseId) ?? [defaultSet()]
      const updated = updater(current)
      const next = new Map(prev)
      next.set(exerciseId, updated)
      return next
    })
  }

  function scheduleSave(exerciseId: number): void {
    clearError(exerciseId)
    controllerRef.current?.schedule(exerciseId)
    syncSaveStates()
  }

  function handleToggleView(exerciseId: number): void {
    setViewModes((prev) => {
      const next = new Map(prev)
      const current = next.get(exerciseId)
      next.set(exerciseId, current === 'past' ? 'current' : 'past')
      return next
    })
    setExerciseSets((prev) => {
      const next = new Map(prev)
      next.delete(exerciseId)
      return next
    })
  }

  function handleAddSet(exerciseId: number): void {
    updateSets(exerciseId, (prev) => [...prev, defaultSet()])
    scheduleSave(exerciseId)
  }

  function handleRemoveSet(exerciseId: number, index: number): void {
    updateSets(exerciseId, (prev) => prev.filter((_, i) => i !== index))
    scheduleSave(exerciseId)
  }

  function handleSetChange(exerciseId: number, index: number, field: keyof WorkoutSet, value: string): void {
    updateSets(exerciseId, (prev) => {
      const updated = [...prev]
      const current = updated[index]
      updated[index] = {
        ...current,
        [field]: field === 'count' ? parseCount(value) : parseFloat(value) || 0,
      }
      return updated
    })
    scheduleSave(exerciseId)
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[24px] pb-[24px]">
        <p className="text-on-surface">Loading...</p>
      </main>
    )
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[24px] pb-[24px]">
        <div className="mb-8 w-full text-center">
          <h1 className="font-headline-xl text-headline-xl uppercase text-on-surface">
            TODAY&apos;S BATTLE
          </h1>
          <div className="mt-2 h-1 w-full bg-on-surface" />
        </div>

        {exercises.length === 0 ? (
          <div className="w-full border-4 border-on-surface bg-surface-container p-6 text-center neo-shadow">
            <p className="font-body-lg text-body-lg text-on-surface">
              No workout scheduled. Set up your routine in Profile.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-8">
            {exercises.map((exercise) => {
              const viewMode = viewModes.get(exercise.exerciseId) ?? 'current'
              const sets = getSets(exercise.exerciseId)
              const saveState = saveStates.get(exercise.exerciseId) ?? 'idle'
              const error = errors.get(exercise.exerciseId) ?? null

              return (
                <ExerciseCard
                  key={exercise.exerciseId}
                  exercise={exercise}
                  viewMode={viewMode}
                  sets={sets}
                  saveState={saveState}
                  error={error}
                  onToggleView={() => handleToggleView(exercise.exerciseId)}
                  onAddSet={() => handleAddSet(exercise.exerciseId)}
                  onRemoveSet={(index) => handleRemoveSet(exercise.exerciseId, index)}
                  onSetChange={(index, field, value) =>
                    handleSetChange(exercise.exerciseId, index, field, value)
                  }
                />
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
