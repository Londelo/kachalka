import type { WorkoutLog, WorkoutSet } from '@/features/workout/types'

export interface WorkoutRepository {
  findById(id: number): WorkoutLog | undefined
  findByDateAndExercise(userId: number, date: string, exerciseId: number): WorkoutLog | undefined
  findByDate(userId: number, date: string): WorkoutLog[]
  findAllByUser(userId: number): WorkoutLog[]
  create(log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>): WorkoutLog
  update(id: number, sets: WorkoutSet[]): WorkoutLog | undefined
  delete(id: number): void
  findByDayOfWeek(userId: number, dayOfWeek: number): { exerciseId: number; exerciseName: string; lastLog?: WorkoutLog }[]
}
