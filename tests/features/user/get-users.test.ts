import { describe, it, expect, vi } from 'vitest'
import { getUsersUseCase } from '@/features/user/get-users'
import type { UserRepository } from '@/features/user/user-repository'

describe('getUsersUseCase', () => {
  it('returns empty array when no users exist', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Test' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toEqual([])
  })

  it('returns a single user', () => {
    const users = [{ id: { value: 1 }, name: 'Alice' }]
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue(users),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Test' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('returns multiple users sorted by name', () => {
    const users = [
      { id: { value: 1 }, name: 'Alice' },
      { id: { value: 2 }, name: 'Bob' },
      { id: { value: 3 }, name: 'Charlie' },
    ]
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue(users),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Test' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('Charlie')
  })

  it('passes through users with all required fields', () => {
    const users = [
      { id: { value: 1 }, name: 'Alice' },
      { id: { value: 2 }, name: 'Bob' },
    ]
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue(users),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Test' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result.every((u) => u.id && u.name)).toBe(true)
  })
})
