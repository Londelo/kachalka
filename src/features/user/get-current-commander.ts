import type { UserRepository } from '@/features/user/user-repository'
import type { User } from '@/features/user/user-entity'
import {
  identified,
  unidentified,
  type CommanderIdentity,
} from '@/features/user/commander-identity'

export function getCurrentCommanderUseCase(repo: UserRepository) {
  return {
    execute(userId: number | null): CommanderIdentity {
      if (userId === null || !Number.isInteger(userId) || userId < 1) {
        return unidentified('no-selection')
      }

      const user: User | undefined = repo.findById(userId)

      if (user === undefined) {
        return unidentified('not-found')
      }

      return identified(user.id.value, user.name)
    },
  }
}
