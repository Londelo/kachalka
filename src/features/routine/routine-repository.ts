import type { RoutineAssignment } from '@/features/routine/routine-entity'

export interface RoutineRepository {
  findById(id: number): RoutineAssignment | undefined
  findByUserAndDay(userId: number, dayOfWeek: number): RoutineAssignment | undefined
  findAllByUser(userId: number): RoutineAssignment[]
  findAllByUserGroupedByDay(userId: number): Record<number, RoutineAssignment[]>
  create(assignment: RoutineAssignment): RoutineAssignment
  delete(id: number): void
  exists(id: number): boolean
  exerciseExists(id: number): boolean
}
