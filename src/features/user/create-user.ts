import type { UserRepository } from '@/features/user/user-repository'
import type { User } from '@/features/user/user-entity'
import { createUser as validateUser } from '@/features/user/user-entity'

export function createUserUseCase(repo: UserRepository) {
  return {
    execute(name: string): User {
      const validated = validateUser(name)
      const existing = repo.findByName(validated.name)

      if (existing) {
        throw new Error('User already exists')
      }

      return repo.create(validated)
    },
  }
}
