'use client'

import { useState, useEffect } from 'react'
import {
  getExercisesWithLogsAction,
  getExerciseChartData,
  getPeakVolumeAction,
  getIntensitySplitAction,
} from '@/features/chart/chart-server-actions'

type DataPoint = {
  date: string
  volume: number
  sets: { id: string; reps: number; weight: number }[]
}

type IntensitySplitItem = {
  type: string
  percentage: number
}

export default function ProgressPage() {
  const [exercises, setExercises] = useState<{ id: number; name: string }[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('')
  const [range, setRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('ALL')
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const [peakVolume, setPeakVolume] = useState<number>(0)
  const [intensitySplit, setIntensitySplit] = useState<IntensitySplitItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!selectedExerciseId) {
        setDataPoints([])
        setPeakVolume(0)
        setIntensitySplit([])
        setLoading(false)
        return
      }

      setLoading(true)
      const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
      const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
      if (!userId) {
        setLoading(false)
        return
      }

      const [chartData, peak, split] = await Promise.all([
        getExerciseChartData(userId, selectedExerciseId, range),
        getPeakVolumeAction(userId, selectedExerciseId),
        getIntensitySplitAction(userId, selectedExerciseId),
      ])

      setDataPoints(chartData ?? [])
      setPeakVolume(peak ?? 0)
      setIntensitySplit(split ?? [])
      setLoading(false)
    }
    loadData()
  }, [selectedExerciseId, range])

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

  function formatVolume(v: number): string {
    return v.toLocaleString('en-US')
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
        {/* Header */}
        <section className="space-y-xs pt-md">
          <h1 className="font-headline-xl text-headline-xl font-black italic uppercase text-on-surface">
            FORCE Progression
          </h1>
        </section>

        {/* Exercise Dropdown */}
        <div className="mt-md w-full space-y-4">
          <label className="font-label-bold text-label-bold uppercase block text-on-surface">
            SELECT EXERCISE
          </label>
          <div className="relative">
            <select
              value={selectedExerciseId ?? ''}
              onChange={handleExerciseChange}
              className="w-full appearance-none border-4 border-on-surface bg-background py-3 pl-4 pr-12 font-label-bold text-label-bold uppercase text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <option value="">SELECT EXERCISE</option>
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
        {selectedExerciseId && (
          <div className="mt-4 flex w-full gap-2">
            {(['1M', '3M', '6M', 'ALL'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`flex-1 border-4 border-on-surface py-2 font-label-bold text-label-bold uppercase transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  range === r
                    ? 'bg-primary text-on-primary shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]'
                    : 'bg-background text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-8 w-full text-center">
            <p className="font-label-bold text-label-bold text-on-surface-variant">LOADING PROGRESSION DATA...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && dataPoints.length === 0 && selectedExerciseId && (
          <div className="mt-8 w-full border-4 border-on-surface bg-surface-container-low p-8 text-center shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant">analytics</span>
            <p className="mt-2 font-headline-md text-headline-md uppercase text-on-surface-variant">
              NO DATA YET
            </p>
            <p className="mt-1 font-label-bold text-label-bold text-on-surface-variant">
              LOG WORKOUTS TO SEE PROGRESSION
            </p>
          </div>
        )}

        {/* Bar Chart */}
        {!loading && dataPoints.length > 0 && (
          <section className="mt-6 w-full">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                show_chart
              </span>
              <h3 className="font-headline-md text-headline-md uppercase">VOLUME BY SESSION</h3>
            </div>

            <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-2">
              {dataPoints.map((dp, idx) => {
                const barHeight = Math.max((dp.volume / maxVolume) * 200, 4)
                return (
                  <div
                    key={dp.date}
                    className="group relative flex flex-col items-center"
                    onMouseEnter={() => setTooltip({ index: idx, x: 0, y: 0 })}
                    onMouseLeave={() => setTooltip(null)}
                    onTouchStart={() => setTooltip({ index: idx, x: 0, y: 0 })}
                    onTouchEnd={() => setTimeout(() => setTooltip(null), 3000)}
                  >
                    {/* Tooltip */}
                    {tooltip?.index === idx && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap border-4 border-on-surface bg-background p-3 font-label-bold text-label-bold text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]"
                        style={{ minWidth: '140px' }}
                      >
                        <div className="mb-1 text-primary">{formatDate(dp.date)}</div>
                        {dp.sets.map((s, i) => (
                          <div key={i}>{s.reps} x {s.weight}</div>
                        ))}
                        <div className="mt-1 border-t-2 border-on-surface pt-1 font-black text-primary">
                          TOTAL: {formatVolume(dp.volume)}
                        </div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className="w-6 border-4 border-on-surface bg-primary transition-all hover:brightness-110 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                      style={{ height: `${barHeight}px`, width: '24px' }}
                    />

                    {/* Date Label */}
                    <span className="mt-1 font-label-mono text-label-mono text-on-surface-variant" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                      {formatDate(dp.date)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Stats Cards Row */}
        {!loading && selectedExerciseId && (
          <section className="mt-6 w-full space-y-4">
            {/* Peak Volume Card */}
            <div className="border-4 border-on-surface bg-background p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emoji_events
                </span>
                <h3 className="font-label-bold text-label-bold uppercase text-on-surface">ALL TIME PEAK</h3>
              </div>
              <p className="mt-2 font-headline-xl text-headline-xl font-black text-primary">
                {formatVolume(peakVolume)}
              </p>
            </div>

            {/* Intensity Split Card */}
            {intensitySplit.length > 0 && (
              <div className="border-4 border-on-surface bg-background p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    donut_large
                  </span>
                  <h3 className="font-label-bold text-label-bold uppercase text-on-surface">INTENSITY SPLIT</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {intensitySplit.map((item) => (
                    <div key={item.type}>
                      <div className="flex justify-between">
                        <span className="font-label-bold text-label-bold uppercase text-on-surface">{item.type}</span>
                        <span className="font-label-bold text-label-bold text-primary">{item.percentage}%</span>
                      </div>
                      <div className="mt-1 h-4 border-2 border-on-surface bg-surface-container-low">
                        <div
                          className="h-full border-r-2 border-on-surface bg-primary transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commander's Intel Card */}
            {dataPoints.length === 0 ? (
              <div className="border-4 border-on-surface bg-error-container p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>
                    warning
                  </span>
                  <div>
                    <h3 className="font-label-bold text-label-bold uppercase text-error">COMMANDER&apos;S INTEL</h3>
                    <p className="mt-1 font-label-bold text-label-bold text-on-surface">
                      INCREASE VOLUME TO SEE PROGRESSION
                    </p>
                  </div>
                </div>
              </div>
            ) : dataPoints.length <= 2 ? (
              <div className="border-4 border-on-surface bg-error-container p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>
                    warning
                  </span>
                  <div>
                    <h3 className="font-label-bold text-label-bold uppercase text-error">COMMANDER&apos;S INTEL</h3>
                    <p className="mt-1 font-label-bold text-label-bold text-on-surface">
                      INSUFFICIENT DATA — LOG MORE SESSIONS TO TRACK PROGRESSION
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-4 border-on-surface bg-surface-container-low p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    info
                  </span>
                  <div>
                    <h3 className="font-label-bold text-label-bold uppercase text-on-surface">COMMANDER&apos;S INTEL</h3>
                    <p className="mt-1 font-label-bold text-label-bold text-on-surface">
                      {dataPoints.length} SESSIONS RECORDED — PROGRESSION TRACKING ACTIVE
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Secondary Progression Card */}
            <div className="border-4 border-on-surface bg-surface-container p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant">trending_flat</span>
                <h3 className="font-label-bold text-label-bold uppercase text-on-surface-variant">SECONDARY PROGRESSION</h3>
              </div>
              <p className="mt-2 font-label-bold text-label-bold text-on-surface-variant">
                NO DATA FOR ESTIMATED 1RM
              </p>
            </div>
          </section>
        )}

        {/* No Exercise Selected State */}
        {!selectedExerciseId && !loading && (
          <div className="mt-12 w-full text-center">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant">bar_chart</span>
            <p className="mt-3 font-headline-md text-headline-md uppercase text-on-surface-variant">
              SELECT AN EXERCISE TO VIEW PROGRESSION
            </p>
          </div>
        )}
      </main>
    </>
  )
}
