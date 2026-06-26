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
    const user = useCase.execute(name.trim())

    return { success: true, user }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return { success: false, error: message }
  }
}

export async function getUsersAction(): Promise<User[]> {
  try {
    const db = getDatabase()
    const repo = createSqliteUserRepository(db)
    const useCase = getUsersUseCase(repo)
    return useCase.execute()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users'
    throw new Error(message)
  }
}

export async function deleteUserAction(
  userId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteUserRepository(db)
    repo.delete(userId)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}
