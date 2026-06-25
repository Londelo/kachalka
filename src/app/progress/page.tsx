'use client'

import { useState, useEffect } from 'react'
import { useLoading } from '@/components/loading-context'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  getExercisesWithLogsAction,
  getExerciseChartData,
  getAllExerciseChartData,
} from '@/features/chart/chart-server-actions'
import type { RangeFilter, TimeGranularity } from '@/features/chart/chart-entity'

type DataPoint = {
  date: string
  volume: number
  sets: { id: string; reps: number; weight: number }[]
  exercises: { name: string; sets: { id: string; reps: number; weight: number }[] }[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function calcExerciseMetrics(exercises: DataPoint['exercises']): {
  name: string
  totalSets: number
  totalReps: number
  totalVolume: number
  maxWeight: number
}[] {
  return exercises.map((ex) => {
    const totalSets = ex.sets.length
    const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0)
    const totalVolume = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0)
    const maxWeight = ex.sets.length > 0 ? Math.max(...ex.sets.map((s) => s.weight)) : 0
    return { name: ex.name, totalSets, totalReps, totalVolume, maxWeight }
  })
}

function formatVolume(v: number): string {
  return v.toLocaleString('en-US')
}

export default function ProgressPage() {
  const [exercises, setExercises] = useState<{ id: number; name: string }[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('')
  const [range, setRange] = useState<RangeFilter>('6M')
  const [granularity, setGranularity] = useState<TimeGranularity>('month')
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBar, setSelectedBar] = useState<DataPoint | null>(null)

  const { start, end } = useLoading()

  useEffect(() => {
    start('progress')
    async function loadData() {
      const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
      const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
      if (!userId) {
        setLoading(false)
        end('progress')
        return
      }

      setLoading(true)

      if (!selectedExerciseId) {
        const chartData = await getAllExerciseChartData(userId, range, granularity)
        setDataPoints(chartData ?? [])
        setLoading(false)
        end('progress')
        return
      }

      const chartData = await getExerciseChartData(userId, selectedExerciseId, range, granularity)
      setDataPoints(chartData ?? [])
      setLoading(false)
      end('progress')
    }
    loadData()
    return () => {
      end('progress')
    }
  }, [selectedExerciseId, range, granularity])

  useEffect(() => {
    async function loadExercises() {
      const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
      const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
      if (!userId) return

      const result = await getExercisesWithLogsAction(userId)
      if (result && Array.isArray(result)) {
        setExercises(result)
      }
    }
    loadExercises()
  }, [])

  function handleExerciseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === '') {
      setSelectedExerciseId(null)
      setSelectedExerciseName('')
      return
    }
    const id = parseInt(val, 10)
    const ex = exercises.find((x) => x.id === id)
    setSelectedExerciseId(id)
    setSelectedExerciseName(ex?.name ?? '')
  }

  const maxVolume = Math.max(...dataPoints.map((dp) => dp.volume), 1)

  return (
    <>
      <main id="progress-page" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[24px] pb-[24px]">
        {/* Header */}
        <section id="progress-header" className="space-y-xs pt-md">
          <h1 className="font-headline-xl text-headline-xl font-black italic uppercase text-on-surface">
            FORCE Progression
          </h1>
        </section>

        {/* Exercise Dropdown */}
        <div id="progress-exercise-selector" className="mt-md w-full space-y-4">
          <label className="font-label-bold text-label-bold uppercase block text-on-surface">
            SELECT EXERCISE
          </label>
          <div className="relative">
            <select
              value={selectedExerciseId ?? ''}
              onChange={handleExerciseChange}
              className="w-full appearance-none border-4 border-on-surface bg-background py-3 pl-4 pr-12 font-label-bold text-label-bold uppercase text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <option value="">ALL EXERCISES</option>
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
        </div>

        {/* Time Range Pills */}
        <div id="progress-range-pills" className="mt-4 flex w-full gap-2">
          {(['6M', '1Y', 'ALL'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`flex-1 border-4 border-on-surface py-2 font-label-bold text-label-bold uppercase transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                range === r
                  ? 'bg-primary text-on-primary'
                  : 'bg-background text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Granularity Pills */}
        <div id="progress-granularity-pills" className="mt-2 flex w-full gap-2">
          {(['session', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`flex-1 border-4 border-on-surface py-2 font-label-bold text-label-bold uppercase transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                granularity === g
                  ? 'bg-primary text-on-primary'
                  : 'bg-background text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {!loading && dataPoints.length === 0 && (
          <div id="progress-empty" className="mt-8 w-full border-4 border-on-surface bg-surface-container-low p-8 text-center shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant">analytics</span>
            <p className="mt-2 font-headline-md text-headline-md uppercase text-on-surface-variant">
              NO DATA YET
            </p>
            <p className="mt-1 font-label-bold text-label-bold text-on-surface-variant">
              LOG WORKOUTS TO SEE PROGRESSION
            </p>
          </div>
        )}

        {/* Recharts Bar Chart */}
        {!loading && dataPoints.length > 0 && (
          <section id="progress-bar-chart" className="mt-6 w-full">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                show_chart
              </span>
              <h3 className="font-headline-md text-headline-md uppercase">
                VOLUME BY {granularity === 'session' ? 'SESSION' : granularity === 'week' ? 'WEEK' : 'MONTH'}
              </h3>
            </div>

            <div className="mt-4 h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(27,29,14,0.2)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fontFamily: 'inherit' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tickFormatter={formatDate}
                  />
                  <YAxis
                    dataKey="volume"
                    tick={{ fontSize: 12, fontFamily: 'inherit' }}
                  />
                  <Bar
                    dataKey="volume"
                    fill="#a20000"
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (data && data.payload) {
                        setSelectedBar(data.payload as DataPoint)
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Detail Modal */}
        {selectedBar && (
          <div
            id="progress-detail-modal"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClickCapture={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedBar(null)
              }
            }}
          >
            <div className="w-full max-w-lg border-4 border-on-surface bg-background p-6 neo-shadow-lg overflow-y-auto max-h-[90vh]">
              {/* Date header */}
              <div className="mb-4">
                <div className="mt-1 border-4 border-on-surface bg-primary px-2 py-0.5 neo-shadow-sm inline-block">
                  <span className="font-label-bold text-label-bold uppercase text-on-primary">
                    {formatFullDate(selectedBar.date)}
                  </span>
                </div>
              </div>

              {/* Exercise rows */}
              <div className="mb-6 flex flex-col gap-2">
                {calcExerciseMetrics(selectedBar.exercises).map((ex) => (
                  <div key={ex.name} className="border-4 border-on-surface bg-surface-container p-3 neo-shadow">
                    <div className="font-headline-sm font-black uppercase text-on-surface">
                      {ex.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-label-bold text-label-bold text-on-surface">
                      <span>{ex.totalSets} sets</span>
                      <span className="text-secondary">·</span>
                      <span>{ex.totalReps} reps</span>
                      <span className="text-secondary">·</span>
                      <span>{ex.totalVolume.toLocaleString()} vol</span>
                      <span className="text-secondary">·</span>
                      <span className="ml-auto text-primary">{ex.maxWeight} max lb</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand total footer */}
              <div className="border-t-4 border-on-surface pt-4 text-center">
                <p className="font-label-mono text-label-mono uppercase text-secondary">TOTAL VOLUME</p>
                <p className="font-headline-md text-headline-md font-black text-primary">
                  {selectedBar.volume.toLocaleString()}
                </p>
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedBar(null)}
                className="mt-6 w-full border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
