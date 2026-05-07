export type WorkoutSet = {
  id: string
  reps: number
  weight: number
}

export type WorkoutLog = {
  id: { value: number }
  userId: number
  exerciseId: number
  date: string
  sets: WorkoutSet[]
  createdAt: string
  updatedAt: string
}
