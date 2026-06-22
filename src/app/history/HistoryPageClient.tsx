'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getHistoryAction, deleteHistoryEntryAction } from '@/features/workout/workout-server-actions'
import { useLoading } from '@/components/loading-context'
import { calculateVolume } from '@/features/workout/workout-entity'

type HistoryEntry = {
  date: string
  logs: {
    id: number
    exerciseId: number
    exerciseName: string
    sets: { id: string; reps: number; weight: number }[]
    volume: number
  }[]
}

export default function HistoryPageClient() {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selectedLog, setSelectedLog] = useState<{
    log: HistoryEntry['logs'][number]
    date: string
    sessionNum: number
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { start, end } = useLoading()

  useEffect(() => {
    start('history')
    const userId = getStoredUserId()
    if (!userId) {
      end('history')
      router.push('/')
      return
    }
    getHistoryAction(userId).then((res) => {
      if (res.success && res.history) {
        setHistory(res.history)
      }
      setLoading(false)
      end('history')
    })
    return () => {
      end('history')
    }
  }, [])

  function getStoredUserId(): number | null {
    const match = document.cookie.match(/kachalka\.userId=(\d+)/)
    return match ? Number(match[1]) : null
  }

  async function handleDelete(logId: number) {
    setDeleting(logId)
    setDeleteError(null)
    const res = await deleteHistoryEntryAction(logId, getStoredUserId() ?? 0)
    if (!res.success) {
      setDeleteError(res.error ?? 'Failed to delete')
    }
    setDeleting(null)
    setDeleteConfirm(null)
    // Refresh history
    const userId = getStoredUserId()
    if (userId) {
      const fresh = await getHistoryAction(userId)
      if (fresh.success && fresh.history) {
        setHistory(fresh.history)
      }
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    return `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }

  function calcIntensity(sets: { reps: number; weight: number }[]): number {
    if (sets.length === 0) return 0
    return Math.max(...sets.map((s) => s.weight))
  }

  return (
    <main id="history-page" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[24px] pb-[24px]">
      {/* Hero Header */}
      <section id="history-header" className="mb-10 w-full text-center">
        <h1 className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
          WAR LOGS
        </h1>
        <div className="mt-3 h-1 w-full bg-on-surface" />
        <p className="mt-3 font-label-bold text-label-bold uppercase text-secondary">
          CAMPAIGN HISTORY & PERFORMANCE DATA
        </p>
      </section>

      {/* Empty state */}
      {history.length === 0 && (
        <div id="history-empty" className="w-full border-4 border-on-surface bg-surface-container p-8 text-center neo-shadow">
          <span className="mb-4 block text-center text-[64px] opacity-40 grayscale">
            <span className="material-symbols-outlined">inbox</span>
          </span>
          <p className="font-label-bold text-label-bold uppercase text-secondary">
            NO WAR RECORDS FOUND
          </p>
          <p className="mt-2 font-label-mono text-label-mono text-secondary">
            COMPLETE YOUR FIRST SESSION TO BEGIN LOGGING HISTORY
          </p>
        </div>
      )}

      {/* History list */}
      {history.length > 0 && history.map((dateEntry, dateIdx) => {
        const sessionNum = dateIdx + 1

        // Aggregate metrics across all exercises in this session
        const totalVolume = dateEntry.logs.reduce((sum, log) => sum + log.volume, 0)
        const totalSets = dateEntry.logs.reduce((sum, log) => sum + log.sets.length, 0)
        const totalReps = dateEntry.logs.reduce(
          (sum, log) => sum + log.sets.reduce((s, set) => s + set.reps, 0),
          0,
        )

        return (
          <section key={dateEntry.date} id={`history-date-${dateEntry.date}`} className="mb-8 w-full">
            {/* Session card */}
            <div
              id={`history-log-list-${dateEntry.date}`}
              className="border-4 border-on-surface bg-tertiary-fixed p-5"
            >
              {/* Date badge */}
              <div className="mb-4 border-4 border-on-surface bg-primary px-3 py-1">
                <span className="font-label-bold text-label-bold uppercase text-on-primary">
                  {formatDate(dateEntry.date)}
                </span>
              </div>

              {/* Exercise list — each row is clickable */}
              <div className="flex flex-col gap-3">
                {dateEntry.logs.map((log) => {
                  const exerciseSets = log.sets.length
                  const exerciseReps = log.sets.reduce((sum, s) => sum + s.reps, 0)
                  const exerciseMaxWeight = calcIntensity(log.sets)
                  return (
                    <button
                      key={log.id}
                      type="button"
                      id={`history-exercise-btn-${log.id}`}
                      className="w-full border-4 border-on-surface bg-surface-container p-4 text-left neo-shadow transition-all active-press"
                      onClick={() =>
                        setSelectedLog({ log, date: dateEntry.date, sessionNum })
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-headline-md text-headline-md uppercase text-on-surface">
                          {log.exerciseName}
                        </span>
                        <div className="flex gap-4">
                          <div className="text-right">
                            <p className="font-label-mono text-label-mono text-secondary">
                              {exerciseSets}
                            </p>
                            <p className="font-label-mono text-label-mono uppercase text-secondary">
                              SETS
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-label-mono text-label-mono text-secondary">
                              {exerciseReps}
                            </p>
                            <p className="font-label-mono text-label-mono uppercase text-secondary">
                              REPS
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-label-mono text-label-mono text-secondary">
                              {exerciseMaxWeight}
                            </p>
                            <p className="font-label-mono text-label-mono uppercase text-secondary">
                              MAX LB
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Aggregate metadata row */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {/* Total Volume */}
                <div className="border-4 border-on-surface bg-on-surface p-3">
                  <p className="font-label-mono text-label-mono uppercase text-background">
                    VOLUME
                  </p>
                  <p className="mt-1 font-headline-md text-headline-md font-black text-tertiary-fixed">
                    {totalVolume.toLocaleString()}
                  </p>
                  <p className="font-label-mono text-label-mono text-background">
                    LB TOTAL
                  </p>
                </div>

                {/* Total Sets */}
                <div className="border-4 border-on-surface bg-on-surface p-3">
                  <p className="font-label-mono text-label-mono uppercase text-background">
                    SETS
                  </p>
                  <p className="mt-1 font-headline-md text-headline-md font-black text-tertiary-fixed">
                    {totalSets}
                  </p>
                  <p className="font-label-mono text-label-mono text-background">
                    COMPLETED
                  </p>
                </div>

                {/* Total Reps */}
                <div className="border-4 border-on-surface bg-on-surface p-3">
                  <p className="font-label-mono text-label-mono uppercase text-background">
                    REPS
                  </p>
                  <p className="mt-1 font-headline-md text-headline-md font-black text-tertiary-fixed">
                    {totalReps}
                  </p>
                  <p className="font-label-mono text-label-mono text-background">
                    COMPLETED
                  </p>
                </div>
              </div>
            </div>
          </section>
        )
      })}

      {/* Delete confirmation dialog */}
      {deleteConfirm !== null && (
        <div id="history-delete-confirm" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm border-4 border-on-surface bg-background p-6 neo-shadow-lg">
            <p className="mb-4 font-headline-md text-headline-md uppercase text-on-surface">
              CONFIRM DELETION
            </p>
            <p className="mb-6 font-body-lg text-body-lg text-on-surface">
              Destroy this war log entry? This action cannot be undone.
            </p>
            {deleteError && (
              <p className="mb-4 font-label-bold text-label-bold text-error">{deleteError}</p>
            )}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border-4 border-on-surface bg-surface-container p-3 font-label-bold text-label-bold uppercase text-on-surface neo-shadow transition-all active-press"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting !== null}
                className="flex-1 border-4 border-on-surface bg-error p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press disabled:opacity-50"
              >
                {deleting === deleteConfirm ? 'DELETING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set detail modal */}
      {selectedLog && (
        <div
          id="history-set-detail-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClickCapture={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLog(null)
            }
          }}
        >
          <div className="w-full max-w-lg border-4 border-on-surface bg-background p-6 neo-shadow-lg">
            {/* Modal header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-headline-md text-headline-md uppercase text-on-surface">
                  {selectedLog.log.exerciseName}
                </h3>
                <div className="mt-1 border-4 border-on-surface bg-primary px-2 py-0.5 neo-shadow-sm inline-block">
                  <span className="font-label-bold text-label-bold uppercase text-on-primary">
                    {formatDate(selectedLog.date)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="border-4 border-on-surface bg-surface-container p-2 neo-shadow-sm transition-all active-press"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Set rows */}
            <div className="mb-6 flex flex-col gap-3">
              {selectedLog.log.sets.map((set, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {/* Set number */}
                  <div className="flex min-w-[80px] flex-1 items-center border-b-4 border-primary pb-2 pt-1">
                    <span className="font-label-mono text-label-mono text-secondary">SET:</span>
                    <span className="font-body-md text-body-md text-on-surface">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  {/* Weight */}
                  <div className="flex min-w-[80px] flex-1 items-center border-b-4 border-primary pb-2 pt-1">
                    <span className="font-label-mono text-label-mono text-secondary">LB:</span>
                    <span className="font-body-md text-body-md text-on-surface">
                      {set.weight}
                    </span>
                  </div>
                  {/* Reps */}
                  <div className="flex min-w-[80px] flex-1 items-center border-b-4 border-primary pb-2 pt-1">
                    <span className="font-label-mono text-label-mono text-secondary">REPS:</span>
                    <span className="font-body-md text-body-md text-on-surface">
                      {set.reps}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary bar */}
            <div className="flex gap-4 border-t-4 border-on-surface pt-4">
              <div className="flex-1 text-center">
                <p className="font-label-mono text-label-mono uppercase text-secondary">VOLUME</p>
                <p className="font-headline-md text-headline-md font-black text-on-surface">
                  {selectedLog.log.volume.toLocaleString()}
                </p>
              </div>
              <div className="flex-1 text-center">
                <p className="font-label-mono text-label-mono uppercase text-secondary">SETS</p>
                <p className="font-headline-md text-headline-md font-black text-on-surface">
                  {selectedLog.log.sets.length}
                </p>
              </div>
              <div className="flex-1 text-center">
                <p className="font-label-mono text-label-mono uppercase text-secondary">MAX LB</p>
                <p className="font-headline-md text-headline-md font-black text-on-surface">
                  {calcIntensity(selectedLog.log.sets)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="mt-6 w-full border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
