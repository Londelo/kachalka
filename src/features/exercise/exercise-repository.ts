import type { Exercise } from '@/features/exercise/exercise-entity'

export interface ExerciseRepository {
  findById(id: number): Exercise | undefined
  findByName(name: string): Exercise | undefined
  findAll(): Exercise[]
  create(exercise: Exercise): Exercise
  updateName(id: number, name: string): Exercise | undefined
  delete(id: number): void
  findByOwner(userId: number): Exercise[]
  inAnyRoutine(id: number): boolean
}
