import { describe, it, expect, vi } from 'vitest'
import { createUserUseCase } from '@/features/user/create-user'
import type { UserRepository } from '@/features/user/user-repository'

describe('createUserUseCase', () => {
  it('creates a user when name is valid and unique', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('Alice')

    expect(result.name).toBe('Alice')
    expect(result.id.value).toBe(1)
  })

  it('throws when user with same name already exists', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice')).toThrow('User already exists')
  })

  it('throws for empty name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('')).toThrow('Name cannot be empty')
  })

  it('throws when repo.create fails', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockImplementation(() => { throw new Error('DB error') }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice')).toThrow('DB error')
  })
})
