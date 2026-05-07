'use client'

import { useState, useEffect, useRef } from 'react'
import { logWorkoutAction, getTodayExercisesAction } from '@/features/workout/workout-server-actions'
import type { WorkoutSet } from '@/features/workout/types'
import { jsDayToAppIndex } from '@/shared/utils/date'

export const dynamic = 'force-dynamic'

interface ExerciseItem {
  exerciseId: number
  exerciseName: string
  lastLog?: {
    weight: number
    reps: number
  } | null
}

export default function TodayPage() {
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null)
  const [sets, setSets] = useState<WorkoutSet[]>([defaultSet()])
  const [volumePreview, setVolumePreview] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Load exercises on mount
  useEffect(() => {
    const userId = getStoredUserId()
    if (userId) {
      const dayOfWeek = jsDayToAppIndex(new Date().getDay())
      getTodayExercisesAction(userId, dayOfWeek).then((res) => {
        if (res.success && res.exercises) {
          setExercises(res.exercises)
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  function handleLogSet(exercise: ExerciseItem): void {
    setSelectedExercise(exercise)
    const last = exercise.lastLog
    setSets(last ? [{ ...defaultSet(), weight: last.weight, reps: last.reps }] : [defaultSet()])
    setVolumePreview(calculateVolumePreview([]))
    setError(null)
    setModalOpen(true)
  }

  function handleAddSet(): void {
    setSets((prev) => [...prev, defaultSet()])
  }

  function handleRemoveSet(index: number): void {
    setSets((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSetChange(index: number, field: keyof WorkoutSet, value: string): void {
    setSets((prev) => {
      const updated = [...prev]
      const current = updated[index]
      updated[index] = { ...current, [field]: parseFloat(value) || 0 }
      return updated
    })
    setVolumePreview(calculateVolumePreview(sets.map((s, i) => i === index ? { ...s, [field]: parseFloat(value) || 0 } : s)))
  }

  function calculateVolumePreview(currentSets: WorkoutSet[]): number {
    return currentSets.reduce((total, set) => total + set.reps * set.weight, 0)
  }

  async function handleSaveSession(): Promise<void> {
    if (!selectedExercise) return
    setSubmitting(true)
    const userId = getStoredUserId()
    if (!userId) return

    const today = new Date().toISOString().split('T')[0]
    const res = await logWorkoutAction(userId, selectedExercise.exerciseId, today, sets)

    if (!res.success) {
      setError(res.error ?? 'Failed to save workout')
      setSubmitting(false)
      return
    }

    // Refresh exercises
    const dayOfWeek = jsDayToAppIndex(new Date().getDay())
    const exRes = await getTodayExercisesAction(userId, dayOfWeek)
    if (exRes.success && exRes.exercises) {
      setExercises(exRes.exercises)
    }

    setModalOpen(false)
    setSubmitting(false)
  }

  function getStoredUserId(): number | null {
    const match = document.cookie.match(/kachalka\.userId=(\d+)/)
    return match ? Number(match[1]) : null
  }

  function defaultSet(): WorkoutSet {
    return { id: crypto.randomUUID(), reps: 1, weight: 0 }
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
              No workout scheduled. Set up your routine in Config.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-8">
            {exercises.map((exercise) => {
              const last = exercise.lastLog
              const volume = last ? last.reps * last.weight : 0

              return (
                <div
                  key={exercise.exerciseId}
                  className="border-4 border-on-surface bg-tertiary-fixed p-6 neo-shadow transition-all active-press"
                >
                  <div className="mb-4">
                    <h2 className="font-headline-md text-headline-md uppercase text-on-surface">
                      {exercise.exerciseName}
                    </h2>
                    <p className="font-label-mono text-label-mono text-secondary">
                      EXERCISE
                    </p>
                  </div>

                  {last ? (
                    <div className="mb-4 grid grid-cols-3 gap-4">
                      <div className="border-4 border-on-surface bg-on-surface p-3">
                        <p className="font-label-mono text-label-mono uppercase text-background">
                          LAST WEIGHT
                        </p>
                        <p className="font-body-lg text-body-lg text-background">
                          {last.weight} LB
                        </p>
                      </div>
                      <div className="border-4 border-on-surface bg-on-surface p-3">
                        <p className="font-label-mono text-label-mono uppercase text-background">
                          LAST REPS
                        </p>
                        <p className="font-body-lg text-body-lg text-background">
                          {last.reps}
                        </p>
                      </div>
                      <div className="border-4 border-on-surface bg-primary p-3">
                        <p className="font-label-mono text-label-mono uppercase text-on-primary">
                          VOLUME
                        </p>
                        <p className="font-body-lg text-body-lg text-on-primary">
                          {volume} LB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 border-b-4 border-dashed border-on-surface pb-4">
                      <p className="font-label-mono text-label-mono text-secondary">
                        NO PREVIOUS SESSIONS
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleLogSet(exercise)}
                    className="w-full border-4 border-on-surface bg-primary p-4 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
                  >
                    LOG SET
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {error && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm border-4 border-on-surface bg-background p-6 neo-shadow-lg text-center">
            <p className="mb-4 font-body-lg text-body-lg text-error">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="w-full border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {modalOpen && selectedExercise && (
        <SetModal
          exerciseName={selectedExercise.exerciseName}
          sets={sets}
          volumePreview={volumePreview}
          onAddSet={handleAddSet}
          onRemoveSet={handleRemoveSet}
          onSetChange={handleSetChange}
          onSave={handleSaveSession}
          onClose={(e?: React.MouseEvent) => {
            if (e && backdropRef.current && !backdropRef.current.contains(e.target as Node)) return
            setModalOpen(false)
          }}
          submitting={submitting}
        />
      )}
    </>
  )
}

interface SetModalProps {
  exerciseName: string
  sets: WorkoutSet[]
  volumePreview: number
  onAddSet: () => void
  onRemoveSet: (index: number) => void
  onSetChange: (index: number, field: keyof WorkoutSet, value: string) => void
  onSave: () => Promise<void>
  onClose: (e?: React.MouseEvent) => void
  submitting: boolean
}

function SetModal({
  exerciseName,
  sets,
  volumePreview,
  onAddSet,
  onRemoveSet,
  onSetChange,
  onSave,
  onClose,
  submitting,
}: SetModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClickCapture={(e) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
          onClose()
        }
      }}
    >
      <div
        ref={contentRef}
        className="w-full max-w-lg border-4 border-on-surface bg-background p-6 neo-shadow-lg"
      >
        <h3 className="mb-4 font-headline-md text-headline-md uppercase text-on-surface">
          {exerciseName}
        </h3>

        <div className="mb-4 flex flex-col gap-4">
          {sets.map((set, index) => (
            <div key={set.id} className="flex items-center gap-2">
              <span className="font-label-mono text-label-mono text-secondary">
                SET {String(index + 1).padStart(2, '0')}
              </span>

              <input
                type="number"
                value={set.weight || ''}
                onChange={(e) => onSetChange(index, 'weight', e.target.value)}
                placeholder="0"
                className="w-20 border-b-4 border-primary-container bg-background px-2 py-1 font-body-md text-body-md text-on-surface outline-none"
              />
              <span className="font-label-mono text-label-mono text-secondary">LB</span>

              <input
                type="number"
                value={set.reps || ''}
                onChange={(e) => onSetChange(index, 'reps', e.target.value)}
                placeholder="0"
                className="w-20 border-b-4 border-primary-container bg-background px-2 py-1 font-body-md text-body-md text-on-surface outline-none"
              />
              <span className="font-label-mono text-label-mono text-secondary">REPS</span>

              <button
                type="button"
                onClick={() => onRemoveSet(index)}
                className="ml-2 border-4 border-on-surface bg-error p-2 text-on-primary neo-shadow transition-all active-press"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddSet}
          className="mb-4 w-full border-4 border-on-surface bg-surface-container p-3 font-label-bold text-label-bold uppercase text-on-surface neo-shadow transition-all active-press"
        >
          ADD SET
        </button>

        <div className="mb-4 border-4 border-on-surface bg-on-surface p-3">
          <p className="font-label-mono text-label-mono uppercase text-background">
            VOLUME
          </p>
          <p className="font-body-lg text-body-lg text-background">
            {volumePreview} LB
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border-4 border-on-surface bg-surface-container p-3 font-label-bold text-label-bold uppercase text-on-surface neo-shadow transition-all active-press"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="flex-1 border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press disabled:opacity-50"
          >
            {submitting ? 'SAVING...' : 'SAVE SESSION'}
          </button>
        </div>
      </div>
    </div>
  )
}
