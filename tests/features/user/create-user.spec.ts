import { describe, it, expect, vi } from 'vitest'
import { createUserUseCase } from '@/features/user/create-user'
import type { UserRepository } from '@/features/user/user-repository'

describe('createUserUseCase', () => {
  it('creates a user when name is valid and unique', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('Alice', 'alice@example.com')

    expect(result.name).toBe('Alice')
    expect(result.email).toBe('alice@example.com')
    expect(result.id.value).toBe(1)
  })

  it('rejects duplicate names', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice', 'alice@example.com')).toThrow('User already exists')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('throws for empty name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('', 'alice@example.com')).toThrow('Name cannot be empty')
  })

  it('throws for whitespace-only name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('   ', 'alice@example.com')).toThrow('Name cannot be empty')
  })

  it('throws for name over 100 characters', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('a'.repeat(101), 'test@example.com')).toThrow('Name too long')
  })

  it('throws for empty email', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice', '')).toThrow('Email cannot be empty')
  })

  it('throws for whitespace-only email', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Alice', email: 'alice@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice', '   ')).toThrow('Email cannot be empty')
  })

  it('trims whitespace from name', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Carol', email: 'carol@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('  Carol  ', 'carol@example.com')

    expect(result.name).toBe('Carol')
  })

  it('trims whitespace from email', () => {
    const repo = {
      findById: vi.fn().mockReturnValue(undefined),
      findByName: vi.fn().mockReturnValue(undefined),
      findAll: vi.fn().mockReturnValue([]),
      create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Dana', email: 'dana@example.com' }),
      delete: vi.fn(),
    } satisfies UserRepository

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('Dana', '  dana@example.com  ')

    expect(result.email).toBe('dana@example.com')
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

    expect(() => useCase.execute('Bob', 'bob@example.com')).toThrow('Database connection lost')
  })
})
