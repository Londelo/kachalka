'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { logWorkoutAction, getTodayWorkoutsAction, getTodayExercisesAction } from '@/features/workout/workout-server-actions'
import { useLoading } from '@/components/loading-context'
import type { SetDraft, SetDraftField } from '@/app/today/set-draft'
import { createBlankSetDraft, generateId, toWorkoutSet } from '@/app/today/set-draft'
import type { IncompleteField } from '@/app/today/saveable-sets'
import { selectSaveableDrafts, describeIncompleteDraftFields } from '@/app/today/saveable-sets'
import { parseSetField } from '@/app/today/set-field'
import { collapseSetDrafts } from '@/app/today/collapse-drafts'
import { createSaveScheduler } from '@/app/today/save-scheduler'
import { jsDayToAppIndex, getTodayLocalDate } from '@/shared/utils/date'

type ExerciseItem = {
  exerciseId: number
  exerciseName: string
  lastLog?: { weight: number; reps: number }[] | null
}

type ViewMode = 'past' | 'current'

const DEBOUNCE_MS = 500

const FIELD_LABELS: Record<SetDraftField, string> = {
  weight: 'WEIGHT',
  reps: 'REPS',
  count: 'SET',
}

const INCOMPLETE_FIELD_ORDER: readonly SetDraftField[] = ['weight', 'reps', 'count']

function joinFieldLabels(fields: SetDraftField[]): string {
  const labels = fields.map((field) => FIELD_LABELS[field])
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

function describeIncompleteDraft(incomplete: IncompleteField[]): string {
  const blank = INCOMPLETE_FIELD_ORDER.filter((field) =>
    incomplete.some((entry) => entry.field === field && entry.reason === 'blank'),
  )
  const invalid = INCOMPLETE_FIELD_ORDER.filter((field) =>
    incomplete.some((entry) => entry.field === field && entry.reason === 'invalid'),
  )

  const clauses: string[] = []
  if (blank.length > 0) {
    clauses.push(`Enter a number for ${joinFieldLabels(blank)} on every set line, or remove the line.`)
  }
  if (invalid.length > 0) {
    clauses.push(`${joinFieldLabels(invalid)} must be a number, or remove the line.`)
  }

  return clauses.join(' ')
}

function getStoredUserId(): number | null {
  const match = document.cookie.match(/kachalka\.userId=(\d+)/)
  return match ? Number(match[1]) : null
}

interface ExerciseCardProps {
  exercise: ExerciseItem
  viewMode: ViewMode
  drafts: SetDraft[]
  saving: boolean
  error: string | null
  invalidFields: IncompleteField[]
  onToggleView: () => void
  onAddSet: () => void
  onRemoveSet: (index: number) => void
  onFieldChange: (index: number, field: SetDraftField, value: string) => void
}

function ExerciseCard({
  exercise,
  viewMode,
  drafts,
  saving,
  error,
  invalidFields,
  onToggleView,
  onAddSet,
  onRemoveSet,
  onFieldChange,
}: ExerciseCardProps) {
  const errorId = `card-error-${exercise.exerciseId}`

  function isFieldInvalid(field: SetDraftField): boolean {
    return invalidFields.some((invalidField) => invalidField.field === field)
  }

  function invalidProps(field: SetDraftField) {
    return isFieldInvalid(field)
      ? { 'aria-invalid': 'true' as const, 'aria-describedby': errorId }
      : {}
  }

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
          {drafts.length > 0 && (
            <div className="mb-4 flex flex-col gap-4">
              {drafts.map((draft, index) => (
                <div key={draft.id} className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">SET:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.raw.count}
                      onChange={(e) => onFieldChange(index, 'count', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                      data-id={`set-count-${exercise.exerciseId}-${draft.id}`}
                      aria-label={`Set count for ${exercise.exerciseName}`}
                      {...invalidProps('count')}
                    />
                  </div>

                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">LB:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.raw.weight}
                      onChange={(e) => onFieldChange(index, 'weight', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                      data-id={`set-weight-${exercise.exerciseId}-${draft.id}`}
                      aria-label={`Weight in pounds for ${exercise.exerciseName}`}
                      {...invalidProps('weight')}
                    />
                  </div>

                  <div className="flex flex-1 flex-row items-center border-4 border-on-surface bg-background neo-shadow focus-within:[box-shadow:none] p-2 gap-2">
                    <span className="font-label-mono text-label-mono text-secondary">REPS:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.raw.reps}
                      onChange={(e) => onFieldChange(index, 'reps', e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent [-moz-appearance:textfield] appearance-none font-body-md text-body-md text-on-surface outline-none [-webkit-appearance:none]"
                      data-id={`set-reps-${exercise.exerciseId}-${draft.id}`}
                      aria-label={`Reps for ${exercise.exerciseName}`}
                      {...invalidProps('reps')}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveSet(index)}
                    className="flex size-8 shrink-0 items-center justify-center border-b-4 border-on-surface bg-error p-1 text-on-primary neo-shadow transition-all active-press"
                    data-id={`remove-set-${exercise.exerciseId}-${draft.id}`}
                    aria-label={`Remove set ${index + 1} for ${exercise.exerciseName}`}
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
            data-id={`add-set-${exercise.exerciseId}`}
          >
            ADD A SET
          </button>
        </>
      )}

      {/* Saving indicator */}
      {saving && (
        <p className="font-label-mono text-label-mono text-secondary">SAVING...</p>
      )}

      {error && (
        <p
          className="mt-2 font-label-bold text-label-bold text-error"
          role="alert"
          id={errorId}
          data-id={errorId}
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

  // Per-exercise state (Map-based)
  const [viewModes, setViewModes] = useState<Map<number, ViewMode>>(new Map())
  const [exerciseSets, setExerciseSets] = useState<Map<number, SetDraft[]>>(new Map())
  const [savingExercises, setSavingExercises] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<Map<number, string>>(new Map())
  const exerciseSetsRef = useRef<Map<number, SetDraft[]>>(new Map())
  // Keep ref in sync with state so debounced callbacks always read fresh data
  exerciseSetsRef.current = exerciseSets

  const schedulerRef = useRef<ReturnType<typeof createSaveScheduler> | null>(null)
  if (schedulerRef.current === null) {
    schedulerRef.current = createSaveScheduler({
      delayMs: DEBOUNCE_MS,
      setTimer: setTimeout,
      clearTimer: clearTimeout,
    })
  }
  const scheduler = schedulerRef.current

  const fallbackRowsRef = useRef<SetDraft[] | null>(null)
  if (fallbackRowsRef.current === null) {
    fallbackRowsRef.current = [createBlankSetDraft()]
  }
  const fallbackRows = fallbackRowsRef.current

  const { start, end } = useLoading()

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
            const nextSets = new Map<number, SetDraft[]>()
            const nextModes = new Map<number, ViewMode>()
            for (const exercise of res.exercises ?? []) {
              const sets = workoutsRes.workouts[exercise.exerciseId]
              if (sets) {
                nextSets.set(exercise.exerciseId, sets.map((s) => ({
                  id: generateId(),
                  weight: s.weight,
                  reps: s.reps,
                  count: s.count ?? null,
                  raw: {
                    weight: String(s.weight),
                    reps: String(s.reps),
                    count: s.count === undefined ? '' : String(s.count),
                  },
                })))
              } else {
                nextSets.set(exercise.exerciseId, [createBlankSetDraft()])
              }
              nextModes.set(exercise.exerciseId, 'current')
            }
            setExerciseSets(nextSets)
            setViewModes(nextModes)
          } else {
            const nextSets = new Map<number, SetDraft[]>()
            const nextModes = new Map<number, ViewMode>()
            for (const exercise of res.exercises ?? []) {
              nextSets.set(exercise.exerciseId, [createBlankSetDraft()])
              nextModes.set(exercise.exerciseId, 'current')
            }
            setExerciseSets(nextSets)
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
    return () => {
      scheduler.flushAll()
      scheduler.clearAll()
    }
  }, [])

  function getSets(exerciseId: number): SetDraft[] {
    return exerciseSets.get(exerciseId) ?? fallbackRows
  }

  function updateSets(exerciseId: number, updater: (prev: SetDraft[]) => SetDraft[]): void {
    setExerciseSets((prev) => {
      const current = prev.get(exerciseId) ?? fallbackRows
      const updated = updater(current)
      const next = new Map(prev)
      next.set(exerciseId, updated)
      return next
    })
  }

  function setCardError(exerciseId: number, message: string): void {
    setErrors((prev) => {
      const next = new Map(prev)
      next.set(exerciseId, message)
      return next
    })
  }

  function clearCardError(exerciseId: number): void {
    setErrors((prev) => {
      if (!prev.has(exerciseId)) return prev
      const next = new Map(prev)
      next.delete(exerciseId)
      return next
    })
  }

  function markSaving(exerciseId: number, saving: boolean): void {
    setSavingExercises((prev) => {
      const has = prev.has(exerciseId)
      if (has === saving) return prev
      const next = new Set(prev)
      if (saving) next.add(exerciseId)
      else next.delete(exerciseId)
      return next
    })
  }

  async function saveExercise(exerciseId: number): Promise<void> {
    const userId = getStoredUserId()
    if (!userId) return

    const drafts = exerciseSetsRef.current.get(exerciseId)
    if (!drafts) return

    const saveable = selectSaveableDrafts(drafts)
    if (saveable.length === 0) return

    const incomplete = saveable.flatMap(describeIncompleteDraftFields)
    if (incomplete.length > 0) {
      setCardError(exerciseId, describeIncompleteDraft(incomplete))
      return
    }

    markSaving(exerciseId, true)

    const res = await logWorkoutAction(
      userId,
      exerciseId,
      getTodayLocalDate(),
      saveable.map(toWorkoutSet),
    )

    markSaving(exerciseId, false)

    if (!res.success) {
      setCardError(exerciseId, res.error ?? 'Failed to save workout')
      return
    }

    clearCardError(exerciseId)

    const dayOfWeek = jsDayToAppIndex(new Date().getDay())
    const exRes = await getTodayExercisesAction(userId, dayOfWeek)
    if (exRes.success && exRes.exercises) {
      setExercises(exRes.exercises)
    }
  }

  function handleToggleView(exerciseId: number): void {
    scheduler.flush(exerciseId)

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
    updateSets(exerciseId, (prev) => [...prev, createBlankSetDraft()])
    scheduler.schedule(exerciseId, () => {
      void saveExercise(exerciseId)
    })
  }

  function handleRemoveSet(exerciseId: number, index: number): void {
    updateSets(exerciseId, (prev) => prev.filter((_, i) => i !== index))
    scheduler.schedule(exerciseId, () => {
      void saveExercise(exerciseId)
    })
  }

  function handleFieldChange(exerciseId: number, index: number, field: SetDraftField, raw: string): void {
    const parsed = parseSetField(raw)

    updateSets(exerciseId, (prev) => {
      const updated = [...prev]
      const current = updated[index]
      if (!current) return prev

      updated[index] = {
        ...current,
        [field]: parsed.kind === 'value' ? parsed.value : null,
        raw: { ...current.raw, [field]: raw },
      }
      return collapseSetDrafts(updated)
    })

    scheduler.schedule(exerciseId, () => {
      void saveExercise(exerciseId)
    })
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
              const drafts = getSets(exercise.exerciseId)
              const saving = savingExercises.has(exercise.exerciseId)
              const error = errors.get(exercise.exerciseId) ?? null
              const invalidFields = error === null
                ? []
                : selectSaveableDrafts(drafts).flatMap(describeIncompleteDraftFields)

              return (
                <ExerciseCard
                  key={exercise.exerciseId}
                  exercise={exercise}
                  viewMode={viewMode}
                  drafts={drafts}
                  saving={saving}
                  error={error}
                  invalidFields={[]}
                  onToggleView={() => handleToggleView(exercise.exerciseId)}
                  onAddSet={() => handleAddSet(exercise.exerciseId)}
                  onRemoveSet={(index) => handleRemoveSet(exercise.exerciseId, index)}
                  onFieldChange={(index, field, raw) =>
                    handleFieldChange(exercise.exerciseId, index, field, raw)
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
