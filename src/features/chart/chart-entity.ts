import type { WorkoutSet } from '@/features/workout/types'

export type ChartDataPoint = {
  date: string
  volume: number
  sets: WorkoutSet[]
}

export type IntensitySplit = {
  type: string
  percentage: number
}
