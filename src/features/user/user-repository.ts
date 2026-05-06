import type { User } from '@/features/user/user-entity'

export interface UserRepository {
  findById(id: number): User | undefined
  findByName(name: string): User | undefined
  findAll(): User[]
  create(user: User): User
  delete(id: number): void
}
