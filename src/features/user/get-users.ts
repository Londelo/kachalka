import type { UserRepository } from '@/features/user/user-repository'
import type { User } from '@/features/user/user-entity'

export function getUsersUseCase(repo: UserRepository) {
  return {
    execute(): User[] {
      return repo.findAll()
    },
  }
}
