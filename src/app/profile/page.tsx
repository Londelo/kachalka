'use client'

import { useState, useEffect, useCallback } from 'react'
import BottomNav from '@/app/components/bottom-nav'
import {
  assignExerciseAction,
  removeExerciseAction,
  getUserRoutineAction,
} from '@/features/routine/routine-server-actions'
import { listExercisesAction } from '@/features/exercise/exercise-server-actions'
import type { RoutineAssignment, DayOfWeek } from '@/features/routine/routine-entity'
import { numberToDayOfWeek } from '@/features/routine/routine-entity'

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

interface ExerciseOption {
  id: number
  name: string
}

export default function ProfilePage() {
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [routine, setRoutine] = useState<Record<number, RoutineAssignment[]> | null>(null)
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  async function handleRemoveExercise(assignmentId: number) {
    const result = await removeExerciseAction(assignmentId)
    if (result.success) {
      await loadData()
    } else {
      setError(result.error ?? 'Failed to remove exercise')
    }
  }

  function getAssignmentsForDay(dayIndex: number): RoutineAssignment[] {
    if (!routine) return []
    return routine[dayIndex] ?? []
  }

  function isSelectedDay(dayIndex: number): boolean {
    return selectedDay === dayIndex && !addingDay
  }

  if (loading) {
    return (
      <>
        <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-8 pb-[140px]">
          <div className="mb-8 w-full text-center">
            <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
              PROFILE
            </h1>
            <p className="mt-2 font-label-mono text-label-mono text-on-surface">LOADING ROUTINE...</p>
          </div>
          <p className="font-label-mono text-label-mono text-on-surface">Loading...</p>
        </main>
        <BottomNav activeTab="PROFILE" />
      </>
    )
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-8 pb-[140px]">
        {/* Hero Header */}
        <div className="mb-8 w-full text-center">
          <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
            PROFILE
          </h1>
          <div className="mt-2 h-1 w-full bg-on-surface" />
          <p className="mt-2 font-label-mono text-label-mono text-on-surface">
            ASSIGN EXERCISES TO YOUR WEEKLY ROUTINE
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 w-full rounded border-2 border-error bg-error-container p-3">
            <p className="font-label-bold text-label-bold text-error">{error}</p>
          </div>
        )}

        {/* Day Selector */}
        <div className="mb-6 flex w-full justify-between gap-1">
          {DAYS.map((day, index) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                if (isSelectedDay(index)) {
                  setAddingDay(index)
                } else {
                  setSelectedDay(index)
                  setAddingDay(null)
                }
              }}
              className={`flex-1 border-4 border-on-surface px-1 py-2 font-label-bold text-label-bold uppercase transition-all active-press ${
                isSelectedDay(index)
                  ? 'bg-primary text-on-primary neo-shadow-sm'
                  : 'bg-surface text-on-surface'
              }`}
            >
              {DAY_LABELS[index]}
            </button>
          ))}
        </div>

        {/* Add Exercise Section */}
        {addingDay !== null && (
          <div className="mb-6 w-full border-4 border-on-surface bg-surface p-4 neo-shadow">
            <h3 className="mb-3 font-headline-md text-headline-md font-black uppercase text-on-surface">
              ADD TO {DAY_LABELS[addingDay]}
            </h3>

            {exercises.length === 0 ? (
              <p className="font-label-mono text-label-mono text-on-surface">NO EXERCISES AVAILABLE</p>
            ) : (
              <>
                <select
                  value={selectedExerciseId ?? ''}
                  onChange={(e) => setSelectedExerciseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="mb-3 w-full border-4 border-on-surface bg-surface p-2 font-label-mono text-label-mono"
                >
                  <option value="">SELECT EXERCISE...</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddExercise}
                    disabled={selectedExerciseId === null}
                    className="flex-1 border-4 border-on-surface bg-primary p-2 font-label-bold text-label-bold uppercase text-on-primary transition-all active-press disabled:opacity-50"
                  >
                    ADD
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingDay(null)
                      setSelectedExerciseId(null)
                    }}
                    className="border-4 border-on-surface bg-surface p-2 font-label-bold text-label-bold uppercase text-on-surface transition-all active-press"
                  >
                    CANCEL
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Exercise List */}
        {DAYS.map((day, dayIndex) => {
          const assignments = getAssignmentsForDay(dayIndex)

          return (
            <div key={day} className="mb-6 w-full">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-headline-md text-headline-md font-black uppercase text-on-surface">
                  {DAY_LABELS[dayIndex]}
                </h3>
                <span className="rounded border-2 border-on-surface bg-surface px-2 py-1 font-label-mono text-[10px] font-bold uppercase text-on-surface">
                  {assignments.length}
                </span>
              </div>

              {assignments.length === 0 ? (
                <div className="flex min-h-[60px] items-center justify-center border-4 border-dashed border-on-surface bg-surface p-4">
                  <p className="font-label-mono text-label-mono text-on-surface">NO EXERCISES ASSIGNED</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignments.map((a) => (
                    <div
                      key={a.id.value}
                      className="flex items-center justify-between border-4 border-on-surface bg-surface p-3 neo-shadow-sm"
                    >
                      <span className="font-label-bold text-label-bold text-on-surface">
                        {exercises.find((ex) => ex.id === a.exerciseId)?.name ?? 'UNKNOWN EXERCISE'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(a.id.value)}
                        className="border-2 border-on-surface bg-error p-2 font-label-bold text-label-bold uppercase text-on-error transition-all active-press"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {assignments.length === 0 && !addingDay && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(dayIndex)
                    setAddingDay(dayIndex)
                  }}
                  className="mt-2 w-full border-4 border-on-surface bg-primary p-2 font-label-bold text-label-bold uppercase text-on-primary transition-all neo-shadow-sm active-press"
                >
                  ADD EXERCISE
                </button>
              )}
            </div>
          )
        })}
      </main>
      <BottomNav activeTab="PROFILE" />
    </>
  )
}
