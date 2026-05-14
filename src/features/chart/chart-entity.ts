import type { WorkoutSet } from '@/features/workout/types'

export type ChartDataPoint = {
  date: string
  volume: number
  sets: WorkoutSet[]
  exercises: { name: string; sets: WorkoutSet[] }[]
}

export type ChartBarData = {
  date: string
  volume: number
  tooltipData?: { sets: WorkoutSet[]; totalVolume: number }
  exercises: { name: string; sets: WorkoutSet[] }[]
}

export type RangeFilter = '6M' | '1Y' | 'ALL'

export type TimeGranularity = 'session' | 'week' | 'month'

export type IntensitySplit = {
  type: string
  percentage: number
}

export type ExerciseInfo = { id: number; name: string }
