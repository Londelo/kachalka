'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignExerciseAction,
  removeExerciseAction,
  getUserRoutineAction,
} from '@/features/routine/routine-server-actions'
import { listExercisesAction, createExerciseAction } from '@/features/exercise/exercise-server-actions'
import type { RoutineAssignment, DayOfWeek } from '@/features/routine/routine-entity'
import { numberToDayOfWeek } from '@/features/routine/routine-entity'
import {
  getAssignmentsForDay,
  getDayLabel,
  isDaySelected,
  resolveDaySelection,
} from '@/app/plan/plan-utils'
import AddExerciseButton from '@/app/components/add-exercise-button'

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface ExerciseOption {
  id: number
  name: string
}

type ModalMode = 'select' | 'new'

export default function PlanPage() {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('select')
  const [routine, setRoutine] = useState<Record<string, RoutineAssignment[]> | null>(null)
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    if (!cookieMatch) {
      router.push('/')
    }
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) {
      setLoading(false)
      return
    }

    const [routineResult, exercisesResult] = await Promise.all([
      getUserRoutineAction(userId),
      listExercisesAction(),
    ])

    if (routineResult.success && routineResult.routine) {
      setRoutine(routineResult.routine)
    } else {
      setError(routineResult.error ?? 'Failed to load routine')
    }

    if (exercisesResult.success && exercisesResult.exercises) {
      setExercises(
        exercisesResult.exercises.map((ex) => ({
          id: ex.id.value,
          name: ex.name,
        }))
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Task 1: Filter exercises to exclude already-assigned ones for the selected day
  const assignedExerciseIds = useMemo(() => {
    if (!routine) return new Set<number>()
    const assignments = getAssignmentsForDay(routine, selectedDay)
    return new Set(assignments.map((a) => a.exerciseId))
  }, [routine, selectedDay])

  const availableExercises = useMemo(() => {
    return exercises.filter((ex) => !assignedExerciseIds.has(ex.id))
  }, [exercises, assignedExerciseIds])

  async function handleAddExercise() {
    if (selectedExerciseId === null) return
    if (addingDay === null) return

    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) return

    const result = await assignExerciseAction(userId, selectedExerciseId, numberToDayOfWeek(addingDay))

    if (result.success && result.assignment) {
      await loadData()
      setAddingDay(null)
      setSelectedExerciseId(null)
    } else {
      setError(result.error ?? 'Failed to add exercise')
    }
  }

  async function handleModalAddExercise() {
    if (selectedExerciseId === null) return
    if (addingDay === null) return

    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) return

    const result = await assignExerciseAction(userId, selectedExerciseId, numberToDayOfWeek(addingDay))

    if (result.success && result.assignment) {
      await loadData()
      setShowModal(false)
      setSelectedExerciseId(null)
    } else {
      setError(result.error ?? 'Failed to add exercise')
    }
  }

  // Task 3: New exercise form handler
  async function handleCreateExercise() {
    if (!newExerciseName.trim()) return
    setError(null)

    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) return

    setCreatingExercise(true)
    const result = await createExerciseAction(newExerciseName.trim(), userId)
    if (result.success && result.exercise && addingDay !== null) {
      // Auto-assign to selected day
      const assignResult = await assignExerciseAction(userId, result.exercise.id.value, numberToDayOfWeek(addingDay))
      if (assignResult.success) {
        setNewExerciseName('')
        setShowModal(false)
        await loadData()
      } else {
        setError(assignResult.error ?? 'Failed to assign exercise')
      }
    } else {
      setError(result.error ?? 'Failed to create exercise')
    }
    setCreatingExercise(false)
  }

  async function handleRemoveExercise(assignmentId: number) {
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) return
    const result = await removeExerciseAction(userId, assignmentId)
    if (result.success) {
      await loadData()
    } else {
      setError(result.error ?? 'Failed to remove exercise')
    }
  }

  function handleDayClick(clickedDayIndex: number) {
    const { nextSelectedDay, nextAddingDay } = resolveDaySelection(selectedDay, addingDay, clickedDayIndex)
    setSelectedDay(nextSelectedDay)
    setAddingDay(nextAddingDay)
  }

  function handleModalClose() {
    setShowModal(false)
    setSelectedExerciseId(null)
    setNewExerciseName('')
  }

  function handleAddExistingClick() {
    // Task 2: Default to 'select' mode; if no exercises available, default to 'new'
    if (availableExercises.length > 0) {
      setModalMode('select')
    } else {
      setModalMode('new')
    }
    setShowModal(true)
  }

  function toggleModalMode() {
    setModalMode((prev) => (prev === 'select' ? 'new' : 'select'))
  }

  if (loading) {
    return (
      <>
        <main id="plan-loading" className="mx-auto flex w-full flex-col items-center px-6 pt-[100px] pb-[140px]">
          <div className="mb-8 w-full text-center">
            <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
              MY BATTLE PLAN
            </h1>
            <p className="mt-2 font-label-mono text-label-mono text-on-surface">LOADING BATTLE PLAN...</p>
          </div>
        </main>
      </>
    )
  }

  const assignments = getAssignmentsForDay(routine, selectedDay)

  return (
    <>
      <main id="plan-page" className="mx-auto flex w-full flex-col items-center px-6 pt-[100px] pb-[140px]">
        {/* Hero Header */}
        <section id="plan-header" className="mb-6 flex flex-wrap items-start justify-between pt-md">
          <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
            MY BATTLE PLAN
          </h1>
        </section>

        {/* Error */}
        {error && (
          <div id="plan-error" className="mb-4 w-full border-2 border-error bg-error-container p-3">
            <p className="font-label-bold text-label-bold text-error">{error}</p>
          </div>
        )}

        {/* Unified workspace: day selector + exercise display */}
        <div id="plan-workspace" className="mx-auto w-full max-w-3xl">
          {/* Day Selector */}
          <section id="plan-day-selector" className="mb-6 flex flex-wrap gap-2">
            {DAYS.map((_, dayIndex) => {
              const selected = isDaySelected(selectedDay, addingDay, dayIndex)
              return (
                <button
                  key={DAYS[dayIndex]}
                  type="button"
                  onClick={() => handleDayClick(dayIndex)}
                  className={`flex-1 min-w-0 border-2 border-on-surface py-3 font-label-bold text-label-bold uppercase transition-colors ${
                    selected
                      ? 'bg-primary text-on-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-variant'
                  }`}
                >
                  {getDayLabel(dayIndex)}
                </button>
              )
            })}
          </section>

          {/* Exercise Display — Selected Day Only */}
        {isDaySelected(selectedDay, addingDay, selectedDay) && (
          <section id="plan-current-assets" className="mb-6 space-y-3">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                emoji_events
              </span>
              <h3 className="font-headline-md text-headline-md uppercase">CURRENT ASSETS</h3>
            </div>

            {assignments.length > 0 ? (
              <div id="plan-assignment-list" className="w-full space-y-3">
                {assignments.map((a, idx) => (
                  <div
                    key={a.id.value}
                    id={`assignment-card-${a.id.value}`}
                    className="w-full bg-surface-container border-2 border-on-surface py-3 px-4 flex justify-between items-start relative overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 w-2 h-full ${idx % 2 === 0 ? 'bg-primary' : 'bg-secondary'}`} />
                    <div className="pl-2 flex flex-1 flex-col">
                      <p className="font-label-mono text-label-mono text-on-surface-variant uppercase">EXERCISE</p>
                      <h4 className="break-words flex-1 font-headline-md text-headline-md leading-none">
                        {exercises.find((ex) => ex.id === a.exerciseId)?.name ?? 'UNKNOWN EXERCISE'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(a.id.value)}
                      className="shrink-0 bg-primary text-on-primary border-2 border-on-surface p-1 flex items-center justify-center active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}

                <AddExerciseButton onSuccess={loadData} />
              </div>
            ) : (
              <div className="w-full opacity-40 grayscale border-2 border-on-surface p-xl flex flex-col items-center text-center gap-3">
                <span className="material-symbols-outlined text-[64px]">block</span>
                <p className="font-headline-md text-headline-md uppercase leading-tight">
                  NO ASSIGNMENTS — DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN
                </p>
              </div>
            )}
          </section>
        )}
        </div>

        {/* Toggle button between select/new modes — always visible when a day is selected */}
        {isDaySelected(selectedDay, addingDay, selectedDay) && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                toggleModalMode()
                setShowModal(true)
              }}
              className="w-full flex items-center justify-center gap-2 border-4 border-on-surface bg-surface-container py-3 font-headline-md font-headline-md uppercase font-bold text-on-surface transition-all active-press"
            >
              {modalMode === 'select' ? 'ADD EXERCISE' : 'SELECT EXERCISE'}
            </button>
          </div>
        )}

        {/* Add Existing Exercise Modal */}
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={handleModalClose}>
            <div
              className="w-full max-w-md border-4 border-on-surface bg-surface-container-high p-6 flex flex-col neo-shadow sm:max-w-sm"
              id="add-existing-exercise-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {modalMode === 'select' ? (
                <>
                  {/* Task 4: Renamed heading */}
                  <h3 className="mb-4 font-headline-md text-headline-md font-black uppercase text-on-surface">
                    ASSIGN EXERCISE
                  </h3>

                  {error && (
                    <p className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error">
                      {error}
                    </p>
                  )}

                  <label className="mb-1 block font-label-bold text-label-bold uppercase">SELECT EXERCISE</label>
                  <div className="relative mb-4">
                    <select
                      value={selectedExerciseId ?? ''}
                      onChange={(e) => setSelectedExerciseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      className="w-full bg-background border-2 border-on-surface p-md font-body-lg appearance-none focus:border-primary focus:ring-0"
                    >
                      <option value="">CHOOSE DRILL...</option>
                      {availableExercises.length === 0 && (
                        <option value="" disabled>
                          NO EXERCISES AVAILABLE
                        </option>
                      )}
                      {availableExercises.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="material-symbols-outlined">expand_more</span>
                    </div>
                  </div>

                  {availableExercises.length === 0 && (
                    <p className="mb-3 text-center text-sm opacity-60">All exercises are already assigned to this day.</p>
                  )}

                  {/* Task 4: DEPLOY → ASSIGN */}
                  <button
                    type="button"
                    onClick={handleModalAddExercise}
                    disabled={selectedExerciseId === null}
                    className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50"
                  >
                    ASSIGN
                  </button>

                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="mt-3 w-full border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors"
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <>
                  {/* Task 3: New exercise form */}
                  <h3 className="mb-4 font-headline-md text-headline-md font-black uppercase text-on-surface">
                    NEW EXERCISE
                  </h3>

                  {error && (
                    <p className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error">
                      {error}
                    </p>
                  )}

                  <label className="mb-1 block font-label-bold text-label-bold uppercase">EXERCISE NAME</label>
                  <input
                    type="text"
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    placeholder="Enter exercise name..."
                    className="w-full bg-background border-2 border-on-surface p-md font-body-lg focus:border-primary focus:ring-0 mb-4"
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={handleCreateExercise}
                    disabled={!newExerciseName.trim() || creatingExercise}
                    className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50"
                  >
                    {creatingExercise ? '...' : 'ADD'}
                  </button>

                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="mt-3 w-full border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors"
                  >
                    CANCEL
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
