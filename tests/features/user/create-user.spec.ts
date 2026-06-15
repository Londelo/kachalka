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

  it('rejects duplicate names', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice')).toThrow('User already exists')
    expect(repo.create).not.toHaveBeenCalled()
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

  it('throws for whitespace-only name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('   ')).toThrow('Name cannot be empty')
  })

  it('throws for name over 100 characters', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('a'.repeat(101))).toThrow('Name too long')
  })

  it('trims whitespace from name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Carol' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('  Carol  ')

    expect(result.name).toBe('Carol')
  })

  it('propagates repo.create errors', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockImplementation(() => { throw new Error('Database connection lost') }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Bob')).toThrow('Database connection lost')
  })
})
