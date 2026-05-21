'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { logWorkoutAction, getTodayExercisesAction } from '@/features/workout/workout-server-actions'
import type { WorkoutSet } from '@/features/workout/types'
import { jsDayToAppIndex } from '@/shared/utils/date'

export const dynamic = 'force-dynamic'

type ExerciseItem = {
  exerciseId: number
  exerciseName: string
  lastLog?: { weight: number; reps: number }[] | null
}

type ViewMode = 'past' | 'current'

const DEBOUNCE_MS = 500

function generateId(): string {
  return crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16) +
    crypto.getRandomValues(new Uint32Array(4))[0].toString(16)
}

function defaultSet(): WorkoutSet {
  return { id: generateId(), reps: 1, weight: 0 }
}

function getStoredUserId(): number | null {
  const match = document.cookie.match(/kachalka\.userId=(\d+)/)
  return match ? Number(match[1]) : null
}

function ExerciseCard({
  exercise,
  viewMode,
  sets,
  saving,
  error,
  onToggleView,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: {
  exercise: ExerciseItem
  viewMode: ViewMode
  sets: WorkoutSet[]
  saving: boolean
  error: string | null
  onToggleView: () => void
  onAddSet: () => void
  onRemoveSet: (index: number) => void
  onSetChange: (index: number, field: keyof WorkoutSet, value: string) => void
}) {
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
                  {/* Set number box */}
                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">SET:</span>
                    <span className="font-body-md text-body-md text-on-surface">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Weight input */}
                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">LB:</span>
                    <input
                      type="number"
                      value={set.weight || ''}
                      onChange={(e) => onSetChange(index, 'weight', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                    />
                  </div>

                  {/* Reps input */}
                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">REPS:</span>
                    <input
                      type="number"
                      value={set.reps || ''}
                      onChange={(e) => onSetChange(index, 'reps', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                    />
                  </div>

                  {/* Delete button */}
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

      {/* Saving indicator */}
      {saving && (
        <p className="font-label-mono text-label-mono text-secondary">SAVING...</p>
      )}

      {/* Per-card error display */}
      {error && (
        <p className="mt-2 font-label-bold text-label-bold text-error">{error}</p>
      )}
    </div>
  )
}

export default function TodayPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [loading, setLoading] = useState(true)

  // Per-exercise state (Map-based)
  const [viewModes, setViewModes] = useState<Map<number, ViewMode>>(new Map())
  const [exerciseSets, setExerciseSets] = useState<Map<number, WorkoutSet[]>>(new Map())
  const [savingExercises, setSavingExercises] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<Map<number, string>>(new Map())
  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const exerciseSetsRef = useRef<Map<number, WorkoutSet[]>>(new Map())
  // Keep ref in sync with state so debounced callbacks always read fresh data
  exerciseSetsRef.current = exerciseSets

  // Load exercises on mount
  useEffect(() => {
    const userId = getStoredUserId()
    if (!userId) {
      router.push('/')
      return
    }
    const dayOfWeek = jsDayToAppIndex(new Date().getDay())
    getTodayExercisesAction(userId, dayOfWeek).then((res) => {
      if (res.success && res.exercises) {
        setExercises(res.exercises)
      }
      setLoading(false)
    })
  }, [])

  // Cleanup: clear all debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // Helper: get sets for an exercise, default to [defaultSet()]
  function getSets(exerciseId: number): WorkoutSet[] {
    const existing = exerciseSets.get(exerciseId)
    return existing ?? [defaultSet()]
  }

  // Helper: update sets in the Map
  function updateSets(exerciseId: number, updater: (prev: WorkoutSet[]) => WorkoutSet[]): void {
    setExerciseSets((prev) => {
      const current = prev.get(exerciseId) ?? [defaultSet()]
      const updated = updater(current)
      const next = new Map(prev)
      next.set(exerciseId, updated)
      return next
    })
  }

  // Helper: trigger debounced save
  function triggerSave(exerciseId: number): void {
    const timers = debounceTimersRef.current
    const existing = timers.get(exerciseId)
    if (existing) {
      clearTimeout(existing)
      timers.delete(exerciseId)
    }
    const timer = setTimeout(() => {
      debouncedSave(exerciseId)
      timers.delete(exerciseId)
    }, DEBOUNCE_MS)
    timers.set(exerciseId, timer)
  }

  // Debounced save: filter empty sets, call logWorkoutAction
  async function debouncedSave(exerciseId: number): Promise<void> {
    const userId = getStoredUserId()
    if (!userId) return

    const sets = exerciseSetsRef.current.get(exerciseId)
    if (!sets) return

    // Filter out sets where both weight and reps are 0
    const validSets = sets.filter((s) => s.weight !== 0 || s.reps !== 0)
    if (validSets.length === 0) return

    setSavingExercises((prev) => {
      const next = new Set(prev)
      next.add(exerciseId)
      return next
    })
    setErrors((prev) => {
      const next = new Map(prev)
      next.delete(exerciseId)
      return next
    })

    const today = new Date().toISOString().split('T')[0]
    const res = await logWorkoutAction(userId, exerciseId, today, validSets)

    setSavingExercises((prev) => {
      const next = new Set(prev)
      next.delete(exerciseId)
      return next
    })

    if (!res.success) {
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(exerciseId, res.error ?? 'Failed to save workout')
        return next
      })
      return
    }

    // Refresh exercises on success
    const dayOfWeek = jsDayToAppIndex(new Date().getDay())
    const exRes = await getTodayExercisesAction(userId, dayOfWeek)
    if (exRes.success && exRes.exercises) {
      setExercises(exRes.exercises)
    }
  }

  // Toggle view mode: clear exerciseSets so it reinitializes on next view
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
    triggerSave(exerciseId)
  }

  function handleRemoveSet(exerciseId: number, index: number): void {
    updateSets(exerciseId, (prev) => prev.filter((_, i) => i !== index))
    triggerSave(exerciseId)
  }

  function handleSetChange(exerciseId: number, index: number, field: keyof WorkoutSet, value: string): void {
    updateSets(exerciseId, (prev) => {
      const updated = [...prev]
      const current = updated[index]
      updated[index] = { ...current, [field]: parseFloat(value) || 0 }
      return updated
    })
    triggerSave(exerciseId)
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[120px] pb-[140px]">
        <p className="text-on-surface">Loading...</p>
      </main>
    )
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[120px] pb-[140px]">
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
              const saving = savingExercises.has(exercise.exerciseId)
              const error = errors.get(exercise.exerciseId) ?? null

              return (
                <ExerciseCard
                  key={exercise.exerciseId}
                  exercise={exercise}
                  viewMode={viewMode}
                  sets={sets}
                  saving={saving}
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
