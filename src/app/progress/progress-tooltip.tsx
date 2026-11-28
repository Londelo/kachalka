'use client'

import type { ChartDataPoint } from '@/features/chart/chart-entity'
import type { WorkoutSet } from '@/features/workout/types'
import { calculateVolume } from '@/features/workout/workout-entity'
import { calcExerciseMetrics, countTotalSets } from './utils'

export type ProgressTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: ChartDataPoint }>
  label?: string | number
}

function safeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readableLines(sets: WorkoutSet[] | undefined): WorkoutSet[] {
  if (!Array.isArray(sets)) return []
  return sets.map((line) => ({
    id: line.id,
    reps: safeNumber(line.reps),
    weight: safeNumber(line.weight),
    count: line.count,
  }))
}

export default function ProgressTooltip({ active, payload, label }: ProgressTooltipProps) {
  if (!active) return null

  const point = payload?.[0]?.payload
  if (!point) return null

  const sets = readableLines(point.sets)
  const totalSets = countTotalSets(sets)
  const totalReps = calcExerciseMetrics([{ name: '', sets }])[0].totalReps
  const totalVolume = calculateVolume(sets)
  const date = point.date ?? label ?? ''

  return (
    <div
      id="progress-tooltip"
      data-id="progress-tooltip"
      role="status"
      aria-live="off"
      className="pointer-events-none border-4 border-on-surface bg-background p-3 neo-shadow"
    >
      <div className="mb-2 border-4 border-on-surface bg-primary px-2 py-0.5 neo-shadow-sm inline-block">
        <span data-id="progress-tooltip-date" className="font-label-bold text-label-bold uppercase text-on-primary">
          {date}
        </span>
      </div>

      <div className="flex flex-col gap-1 font-label-bold text-label-bold uppercase text-on-surface">
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">Sets</span>
          <span data-id="progress-tooltip-sets" className="ml-auto">{totalSets} sets</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">Reps</span>
          <span data-id="progress-tooltip-reps" className="ml-auto">{totalReps} reps</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant">Volume</span>
          <span data-id="progress-tooltip-volume" className="ml-auto text-primary">
            {totalVolume.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
