import { describe, it, expect, vi } from 'vitest'
import { createUserUseCase } from './create-user'
import type { UserRepository } from './user-repository'

function makeRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  }
}

describe('createUserUseCase', () => {
  it('creates a user when name is valid and not duplicate', () => {
    const repo = makeRepo()
    repo.findByName.mockReturnValue(undefined)
    const persistedUser = { id: { value: 42 }, name: 'Alice' }
    repo.create.mockReturnValue(persistedUser)

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('Alice')

    expect(result).toEqual(persistedUser)
    expect(repo.findByName).toHaveBeenCalledWith('Alice')
    expect(repo.create).toHaveBeenCalledWith({ id: { value: 0 }, name: 'Alice' })
  })

  it('rejects duplicate names', () => {
    const repo = makeRepo()
    repo.findByName.mockReturnValue({ id: { value: 1 }, name: 'Alice' })

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Alice')).toThrow('User already exists')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects empty names', () => {
    const repo = makeRepo()

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('')).toThrow('Name cannot be empty')
    expect(repo.findByName).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only names', () => {
    const repo = makeRepo()

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('   ')).toThrow('Name cannot be empty')
    expect(repo.findByName).not.toHaveBeenCalled()
  })

  it('rejects names over 100 characters', () => {
    const repo = makeRepo()
    const longName = 'a'.repeat(101)

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute(longName)).toThrow('Name too long')
    expect(repo.findByName).not.toHaveBeenCalled()
  })

  it('propagates repo.create errors', () => {
    const repo = makeRepo()
    repo.findByName.mockReturnValue(undefined)
    repo.create.mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    const useCase = createUserUseCase(repo)

    expect(() => useCase.execute('Bob')).toThrow('Database connection lost')
  })

  it('trims the name before validation and storage', () => {
    const repo = makeRepo()
    repo.findByName.mockReturnValue(undefined)
    const persistedUser = { id: { value: 1 }, name: 'Carol' }
    repo.create.mockReturnValue(persistedUser)

    const useCase = createUserUseCase(repo)
    const result = useCase.execute('  Carol  ')

    expect(result.name).toBe('Carol')
    expect(repo.findByName).toHaveBeenCalledWith('Carol')
  })
})
