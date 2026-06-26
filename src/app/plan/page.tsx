"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  assignExerciseAction,
  removeAssignmentAction,
  getUserRoutineAction,
} from "@/features/routine/routine-server-actions";
import {
  listExercisesAction,
  createExerciseAction,
} from "@/features/exercise/exercise-server-actions";
import type { RoutineAssignment } from "@/features/routine/routine-entity";
import { numberToDayOfWeek, DAY_NAMES } from "@/features/routine/routine-entity";
import { getAssignmentsForDay, getDayLabel, isDaySelected } from './utils'
import { useLoading } from '@/components/loading-context'

const DAYS = DAY_NAMES;

/** Extract the current user ID from the session cookie. */
function getUserId(): number {
  const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/);
  return cookieMatch ? parseInt(cookieMatch[1], 10) : 0;
}

interface ExerciseOption {
  id: number;
  name: string;
}

type ModalMode = "select" | "new";

export default function PlanPage() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<number>(
    () => (new Date().getDay() + 6) % 7,
  );
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("select");
  const [routine, setRoutine] = useState<Record<
    string,
    RoutineAssignment[]
  > | null>(null);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(
    null,
  );
  const [newExerciseName, setNewExerciseName] = useState("");
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = useRef(false);

  useEffect(() => {
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/);
    if (!cookieMatch) {
      router.push("/");
    }
  }, [router]);

  const { start, end } = useLoading()
  const loadData = useCallback(async () => {
    start('plan')
    setLoading(true)
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) {
      setLoading(false);
      return false;
    }

    const [routineResult, exercisesResult] = await Promise.all([
      getUserRoutineAction(userId),
      listExercisesAction(),
    ]);

    if (routineResult.success && routineResult.routine) {
      setRoutine(routineResult.routine);
    } else {
      setError(routineResult.error ?? "Failed to load routine");
    }

    if (exercisesResult.success && exercisesResult.exercises) {
      setExercises(
        exercisesResult.exercises.map((ex) => ({
          id: ex.id.value,
          name: ex.name,
        })),
      );
    }

    setLoading(false)
    end('plan')
    return true
  }, [start, end])

  useEffect(() => {
    loadData();
    return () => {
      end('plan');
    };
  }, [loadData, end]);

  // Task 1: Filter exercises to exclude already-assigned ones for the selected day
  const assignedExerciseIds = useMemo(() => {
    if (!routine) return new Set<number>();
    const assignments = getAssignmentsForDay(routine, selectedDay);
    return new Set(assignments.map((a) => a.exerciseId));
  }, [routine, selectedDay]);

  const availableExercises = useMemo(() => {
    return exercises.filter((ex) => !assignedExerciseIds.has(ex.id));
  }, [exercises, assignedExerciseIds]);

  async function handleModalAddExercise() {
    if (isSubmitting.current) return;
    if (selectedExerciseId === null) return;

    const userId = getUserId();
    if (!userId) return;

    isSubmitting.current = true;
    const result = await assignExerciseAction(
      userId,
      selectedExerciseId,
      numberToDayOfWeek(selectedDay),
    );
    isSubmitting.current = false;

    // selectedDay is always set when a day is clicked (no toggle mode)
    // so selectedDay is the correct assignment target
    if (result.success && result.assignment) {
      const refreshed = await loadData();
      if (!refreshed) {
        setError(
          "Exercise assigned but failed to refresh data. Please try again.",
        );
      } else {
        setShowModal(false);
        setSelectedExerciseId(null);
        setError(null);
      }
    } else {
      setError(result.error ?? "Failed to add exercise");
    }
  }

  // Task 3: New exercise form handler
  async function handleCreateExercise() {
    if (!newExerciseName.trim()) return;
    if (isSubmitting.current) return;
    setError(null);

    const userId = getUserId();
    if (!userId) return;

    isSubmitting.current = true;
    setCreatingExercise(true);
    const result = await createExerciseAction(newExerciseName.trim(), userId);
    if (result.success && result.exercise) {
      // Auto-assign to selected day
      const assignResult = await assignExerciseAction(
        userId,
        result.exercise.id.value,
        numberToDayOfWeek(selectedDay),
      );
      if (assignResult.success) {
        const refreshed = await loadData();
        if (!refreshed) {
          setError(
            "Exercise created but failed to refresh data. Please try again.",
          );
        } else {
          setNewExerciseName("");
          setShowModal(false);
        }
      } else {
        setError(assignResult.error ?? "Failed to assign exercise");
      }
    } else {
      setError(result.error ?? "Failed to create exercise");
    }
    setCreatingExercise(false);
    isSubmitting.current = false;
  }

  async function handleRemoveExercise(assignmentId: number) {
    const userId = getUserId();
    if (!userId) return;
    const result = await removeAssignmentAction(userId, assignmentId);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Failed to remove exercise");
    }
  }

  function handleDayClick(dayIndex: number) {
    // Always just select the day — no toggle between viewing/adding modes
    setSelectedDay(dayIndex);
  }

  function handleModalClose() {
    setShowModal(false);
    setSelectedExerciseId(null);
    setNewExerciseName("");
    setError(null);
  }

  function handleAddExistingClick() {
    setSelectedExerciseId(null);
    setNewExerciseName('');
    setError(null);
    // Task 2: Default to 'select' mode; if no exercises available, default to 'new'
    if (availableExercises.length > 0) {
      setModalMode("select");
    } else {
      setModalMode("new");
    }
    setShowModal(true);
  }

  const assignments = getAssignmentsForDay(routine, selectedDay)

  return (
    <>
      <main
        id="plan-page"
        className="mx-auto flex w-full flex-col items-center px-6 pt-[24px] pb-[24px]"
      >
        {/* Hero Header */}
        <section
          id="plan-header"
          className="mb-6 flex flex-wrap items-start justify-between pt-md"
        >
          <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
            MY BATTLE PLAN
          </h1>
        </section>

        {/* Error */}
        {error && (
          <div
            id="plan-error"
            className="mb-4 w-full border-2 border-error bg-error-container p-3"
          >
            <p className="font-label-bold text-label-bold text-error">
              {error}
            </p>
          </div>
        )}

        {/* Unified workspace: day selector + exercise display */}
        <div id="plan-workspace" className="mx-auto w-full max-w-3xl">
          {/* Day Selector */}
          <section id="plan-day-selector" className="mb-6 flex flex-wrap gap-2">
            {DAYS.map((_, dayIndex) => {
              const selected = isDaySelected(selectedDay, dayIndex);
              return (
                <button
                  key={DAYS[dayIndex]}
                  type="button"
                  onClick={() => handleDayClick(dayIndex)}
                  className={`flex-1 min-w-0 border-2 border-on-surface py-3 font-label-bold text-label-bold uppercase transition-colors ${
                    selected
                      ? "bg-primary text-on-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                      : "bg-surface-container-low text-on-surface hover:bg-surface-variant"
                  }`}
                >
                  {getDayLabel(dayIndex)}
                </button>
              );
            })}
          </section>

          {/* Exercise Display — Selected Day Only */}
          {isDaySelected(selectedDay, selectedDay) && (
            <section id="plan-current-assets" className="mb-6 space-y-3">
              <div className="flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  emoji_events
                </span>
                <h3 className="font-headline-md text-headline-md uppercase">
                  CURRENT ASSETS
                </h3>
              </div>

              {assignments.length > 0 ? (
                <div id="plan-assignment-list" className="w-full space-y-3">
                  {assignments.map((a, idx) => (
                    <div
                      key={a.id.value}
                      id={`assignment-card-${a.id.value}`}
                      className="w-full bg-surface-container border-2 border-on-surface py-3 px-4 flex justify-between items-start relative overflow-hidden"
                    >
                      <div
                        className={`absolute top-0 left-0 w-2 h-full ${idx % 2 === 0 ? "bg-primary" : "bg-secondary"}`}
                      />
                      <div className="pl-2 flex flex-1 flex-col">
                        <p className="font-label-mono text-label-mono text-on-surface-variant uppercase">
                          EXERCISE
                        </p>
                        <h4 className="break-words flex-1 font-headline-md text-headline-md leading-none">
                          {exercises.find((ex) => ex.id === a.exerciseId)
                            ?.name ?? "UNKNOWN EXERCISE"}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(a.id.value)}
                        className="shrink-0 bg-primary text-on-primary border-2 border-on-surface p-1 flex items-center justify-center neo-shadow active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full opacity-40 grayscale border-2 border-on-surface p-xl flex flex-col items-center text-center gap-3">
                  <span className="material-symbols-outlined text-[64px]">
                    block
                  </span>
                  <p className="font-headline-md text-headline-md uppercase leading-tight">
                    NO ASSIGNMENTS — DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Add Exercise button — opens modal in select mode */}
          {isDaySelected(selectedDay, selectedDay) && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleAddExistingClick}
                className="w-full max-w-sm border-4 border-on-surface bg-background py-3 font-headline-md uppercase font-bold text-on-surface transition-all active-press"
              >
                ADD EXERCISE
              </button>
            </div>
          )}
        </div>

        {/* Add Existing Exercise Modal */}
        {showModal && (
          <div
            id="plan-modal"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClick={handleModalClose}
            role="dialog"
            aria-label={
              modalMode === "select" ? "Assign exercise" : "Create new exercise"
            }
            aria-modal="true"
          >
            <div
              className="w-full max-w-md border-4 border-on-surface bg-surface-container-high p-6 flex flex-col neo-shadow sm:max-w-sm"
              id="add-existing-exercise-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {modalMode === "select" ? (
                <>
                  {/* Task 4: Renamed heading with toggle button */}
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-headline-md text-headline-md font-black uppercase text-on-surface">
                      ASSIGN EXERCISE
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModalMode("new")}
                      className="flex size-10 shrink-0 items-center justify-center border-2 border-on-surface bg-background font-headline-md uppercase font-bold text-on-surface neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
                      aria-label="Create new exercise"
                      title="Create new exercise"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>

                  {error && (
                    <p
                      className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  <label className="mb-1 block font-label-bold text-label-bold uppercase">
                    SELECT EXERCISE
                  </label>
                  <div className="relative mb-4">
                    <select
                      value={selectedExerciseId ?? ""}
                      onChange={(e) =>
                        setSelectedExerciseId(
                          e.target.value ? parseInt(e.target.value, 10) : null,
                        )
                      }
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
                      <span className="material-symbols-outlined">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {availableExercises.length === 0 && (
                    <p className="mb-3 text-center text-sm opacity-60">
                      All exercises are already assigned to this day.
                    </p>
                  )}

                  {/* Task 4: DEPLOY → ASSIGN */}
                  <button
                    type="button"
                    onClick={handleModalAddExercise}
                    disabled={selectedExerciseId === null}
                    className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 transition-all"
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
                  {/* Task 3: New exercise form with toggle button */}
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-headline-md text-headline-md font-black uppercase text-on-surface">
                      NEW EXERCISE
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModalMode("select")}
                      className="flex size-10 shrink-0 items-center justify-center border-2 border-on-surface bg-background font-headline-md uppercase font-bold text-on-surface neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
                      aria-label="Select existing exercise"
                      title="Select existing exercise"
                    >
                      <span className="material-symbols-outlined">
                        arrow_back
                      </span>
                    </button>
                  </div>

                  {error && (
                    <p
                      className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  <label className="mb-1 block font-label-bold text-label-bold uppercase">
                    EXERCISE NAME
                  </label>
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
                    className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50"
                  >
                    {creatingExercise ? "..." : "ADD"}
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
  );
}
