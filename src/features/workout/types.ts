export type WorkoutSet = {
  id: string
  reps: number
  weight: number
  count?: number
}

export type WorkoutLog = {
  id: number
  userId: number
  exerciseId: number
  date: string
  sets: WorkoutSet[]
  createdAt: string
  updatedAt: string
}

export type HistoryLog = {
  id: number
  exerciseId: number
  exerciseName: string
  sets: WorkoutSet[]
  volume: number
}

export type HistoryEntry = {
  date: string
  logs: HistoryLog[]
}
