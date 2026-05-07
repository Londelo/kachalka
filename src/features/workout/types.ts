export type WorkoutSet = {
  reps: number
  weight: number
  rpe: number
  rest: number
  note: string
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
