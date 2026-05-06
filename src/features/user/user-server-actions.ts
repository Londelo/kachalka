'use server'

import { getDatabase } from '@/config/db'
import { createSqliteUserRepository } from '@/features/user/user-repo-impl'
import { createUserUseCase } from '@/features/user/create-user'
import { getUsersUseCase } from '@/features/user/get-users'
import type { User } from '@/features/user/user-entity'

export async function createUserAction(
  name: string,
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { success: false, error: 'Name is required' }
    }

    const db = getDatabase()
    const repo = createSqliteUserRepository(db)
    const useCase = createUserUseCase(repo)
    const user = useCase.execute(name)

    return { success: true, user }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return { success: false, error: message }
  }
}

export async function getUsersAction(): Promise<User[]> {
  const db = getDatabase()
  const repo = createSqliteUserRepository(db)
  const useCase = getUsersUseCase(repo)
  return useCase.execute()
}
