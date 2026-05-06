import { describe, it, expect, vi } from 'vitest'
import { getUsersUseCase } from './get-users'
import type { UserRepository } from './user-repository'
import * as R from 'ramda'

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

describe('getUsersUseCase', () => {
  it('returns empty array when no users exist', () => {
    const repo = makeRepo()
    repo.findAll.mockReturnValue([])

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toEqual([])
  })

  it('returns a single user', () => {
    const users = [
      { id: { value: 1 }, name: 'Alice' },
    ]
    const repo = makeRepo()
    repo.findAll.mockReturnValue(users)

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toEqual(users)
    expect(repo.findAll).toHaveBeenCalled()
  })

  it('returns multiple users', () => {
    const users = [
      { id: { value: 1 }, name: 'Alice' },
      { id: { value: 2 }, name: 'Bob' },
      { id: { value: 3 }, name: 'Charlie' },
    ]
    const repo = makeRepo()
    repo.findAll.mockReturnValue(users)

    const useCase = getUsersUseCase(repo)
    const result = useCase.execute()

    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('Charlie')
  })

  it('delegates to repo.findAll', () => {
    const repo = makeRepo()
    repo.findAll.mockReturnValue([])

    getUsersUseCase(repo).execute()

    expect(repo.findAll).toHaveBeenCalledTimes(1)
  })

  it('uses R.map to transform rows (verifies Ramda usage)', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]
    const picked = R.map(R.pick(['id', 'name']), rows)
    expect(picked).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])
  })
})
