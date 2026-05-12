'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignExerciseAction,
  removeExerciseAction,
  getUserRoutineAction,
} from '@/features/routine/routine-server-actions'
import { listExercisesAction } from '@/features/exercise/exercise-server-actions'
import type { RoutineAssignment, DayOfWeek } from '@/features/routine/routine-entity'
import { numberToDayOfWeek } from '@/features/routine/routine-entity'
import {
  getAssignmentsForDay,
  getDayLabel,
  isDaySelected,
  resolveDaySelection,
} from '@/app/profile/profile-utils'
import NewRecruitButton from '@/app/components/new-recruit-button'

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface ExerciseOption {
  id: number
  name: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [routine, setRoutine] = useState<Record<string, RoutineAssignment[]> | null>(null)
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
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

  if (loading) {
    return (
      <>
        <main id="profile-loading" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
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
      <main id="profile-page" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
        {/* Hero Header */}
        <section id="profile-header" className="flex items-start justify-between space-y-xs pt-md">
          <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
            MY BATTLE PLAN
          </h1>
          <NewRecruitButton variant="compact" />
        </section>

        {/* Error */}
        {error && (
          <div id="profile-error" className="mb-4 w-full border-2 border-error bg-error-container p-3">
            <p className="font-label-bold text-label-bold text-error">{error}</p>
          </div>
        )}

        {/* Day Selector */}
        <section id="profile-day-selector" className="flex gap-2 overflow-x-auto pb-2">
          {DAYS.map((_, dayIndex) => {
            const selected = isDaySelected(selectedDay, addingDay, dayIndex)
            return (
              <button
                key={DAYS[dayIndex]}
                type="button"
                onClick={() => handleDayClick(dayIndex)}
                className={`flex-1 min-w-[60px] border-2 border-on-surface py-3 font-label-bold text-label-bold uppercase transition-colors ${
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
          <section id="profile-current-assets" className="space-y-3">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                emoji_events
              </span>
              <h3 className="font-headline-md text-headline-md uppercase">CURRENT ASSETS</h3>
            </div>

            {assignments.length > 0 ? (
              <div id="profile-assignment-list" className="w-full space-y-3">
                {assignments.map((a, idx) => (
                  <div
                    key={a.id.value}
                    id={`assignment-card-${a.id.value}`}
                    className="bg-surface-container border-2 border-on-surface py-3 px-4 flex justify-between items-start relative overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 w-2 h-full ${idx % 2 === 0 ? 'bg-primary' : 'bg-secondary'}`} />
                    <div className="pl-2 space-y-1">
                      <p className="font-label-mono text-label-mono text-on-surface-variant uppercase">EXERCISE</p>
                      <h4 className="font-headline-md text-headline-md leading-none">
                        {exercises.find((ex) => ex.id === a.exerciseId)?.name ?? 'UNKNOWN EXERCISE'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(a.id.value)}
                      className="bg-primary text-on-primary border-2 border-on-surface p-1 flex items-center justify-center active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="opacity-40 grayscale border-2 border-on-surface p-xl flex flex-col items-center text-center gap-3">
                <span className="material-symbols-outlined text-[64px]">block</span>
                <p className="font-headline-md text-headline-md uppercase leading-tight">
                  NO ASSIGNMENTS — DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN
                </p>
              </div>
            )}
          </section>
        )}

        {/* Add Exercise Panel */}
        {addingDay !== null && (
          <section id="profile-add-exercise-panel" className="bg-surface-container-highest border-4 border-on-surface py-6 px-4 neo-shadow-lg space-y-3">
            <h3 className="font-headline-md text-headline-md uppercase tracking-tight">REINFORCE LINEUP</h3>
            <label className="font-label-bold text-label-bold uppercase block">SELECT EXERCISE</label>
            <div className="relative">
              <select
                value={selectedExerciseId ?? ''}
                onChange={(e) => setSelectedExerciseId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full bg-background border-2 border-on-surface p-md font-body-lg appearance-none focus:border-primary focus:ring-0"
              >
                <option value="">CHOOSE DRILL...</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddExercise}
              disabled={selectedExerciseId === null}
              className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50"
            >
              DEPLOY
            </button>
          </section>
        )}

      </main>
    </>
  )
}
