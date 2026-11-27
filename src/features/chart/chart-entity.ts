import type { WorkoutSet } from '@/features/workout/types'

export type ChartDataPoint = {
  date: string
  volume: number
  sets: WorkoutSet[]
  exercises: { name: string; sets: WorkoutSet[]; setCount: number }[]
}

export type ChartBarData = {
  date: string
  volume: number
  tooltipData?: { sets: WorkoutSet[]; totalVolume: number; setCount: number }
  exercises: { name: string; sets: WorkoutSet[]; setCount: number }[]
}

export type RangeFilter = '6M' | '1Y' | 'ALL'

export type TimeGranularity = 'session' | 'week' | 'month'

export type IntensitySplit = {
  type: string
  percentage: number
}

export type ExerciseInfo = { id: number; name: string }
