'use client'

import { useState, useEffect } from 'react'
import { useLoading } from '@/app/components/loading-context'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
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

export default function ProgressPage() {
  const [exercises, setExercises] = useState<{ id: number; name: string }[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('')
  const [range, setRange] = useState<RangeFilter>('6M')
  const [granularity, setGranularity] = useState<TimeGranularity>('session')
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

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

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function formatTooltipDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dayPart = d.toLocaleDateString('en-US', { weekday: 'short' })
    return `${datePart}, ${dayPart.toUpperCase()}`
  }

  function formatVolume(v: number): string {
    return v.toLocaleString('en-US')
  }

  return (
    <>
      <main id="progress-page" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
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
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as DataPoint
                        return (
                          <div className="border-4 border-on-surface bg-background p-3 font-label-bold text-label-bold text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
                            <div className="mb-1 text-primary">{formatTooltipDate(data.date)}</div>
                            {data.exercises.map((ex, i) => {
                              const totalSets = ex.sets.length
                              const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0)
                              const weights = ex.sets.map((s) => s.weight)
                              return (
                                <div key={i}>
                                  <div className="font-black">{ex.name}</div>
                                  <div>{totalSets} set{totalSets !== 1 ? 's' : ''} · {totalReps} reps · {weights.join(', ')}</div>
                                </div>
                              )
                            })}
                            <div className="mt-1 border-t-2 border-on-surface pt-1 font-black text-primary">
                              TOTAL: {formatVolume(data.volume)}
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar
                    dataKey="volume"
                    fill="#a20000"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </main>
    </>
  )
}
