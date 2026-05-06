import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDb = {}

const mockRepo = {
  findById: vi.fn(),
  findByName: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}

const mockCreateUser = {
  execute: vi.fn(),
}

const mockGetUsers = {
  execute: vi.fn(),
}

const mockUser = {
  id: { value: 1 },
  name: 'Alice',
}

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

vi.mock('./user-repo-impl', () => ({
  createSqliteUserRepository: vi.fn(() => mockRepo),
}))

vi.mock('./create-user', () => ({
  createUserUseCase: vi.fn(() => mockCreateUser),
}))

vi.mock('./get-users', () => ({
  getUsersUseCase: vi.fn(() => mockGetUsers),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('createUserAction', () => {
  it('returns success with user on valid name', async () => {
    mockCreateUser.execute.mockReturnValue(mockUser)

    const { createUserAction } = await import('./user-server-actions')
    const result = await createUserAction('Alice')

    expect(result.success).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeUndefined()
  })

  it('returns failure when user already exists', async () => {
    mockCreateUser.execute.mockImplementation(() => {
      throw new Error('User already exists')
    })

    const { createUserAction } = await import('./user-server-actions')
    const result = await createUserAction('Alice')

    expect(result.success).toBe(false)
    expect(result.error).toBe('User already exists')
    expect(result.user).toBeUndefined()
  })

  it('returns failure for empty name', async () => {
    const { createUserAction } = await import('./user-server-actions')
    const result = await createUserAction('')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Name is required')
  })

  it('does not expose internal errors to clients', async () => {
    mockCreateUser.execute.mockImplementation(() => {
      throw new Error('Connection refused: ECONNREFUSED')
    })

    const { createUserAction } = await import('./user-server-actions')
    const result = await createUserAction('Alice')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused: ECONNREFUSED')
  })

  it('returns failure for non-string input', async () => {
    const { createUserAction } = await import('./user-server-actions')
    const result = await createUserAction(null as unknown as string)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Name is required')
  })
})

describe('getUsersAction', () => {
  it('returns user list on success', async () => {
    mockGetUsers.execute.mockReturnValue([mockUser])

    const { getUsersAction } = await import('./user-server-actions')
    const result = await getUsersAction()

    expect(result).toEqual([mockUser])
  })

  it('returns empty array when no users exist', async () => {
    mockGetUsers.execute.mockReturnValue([])

    const { getUsersAction } = await import('./user-server-actions')
    const result = await getUsersAction()

    expect(result).toEqual([])
  })

  it('returns multiple users', async () => {
    const users = [
      { id: { value: 1 }, name: 'Alice' },
      { id: { value: 2 }, name: 'Bob' },
    ]
    mockGetUsers.execute.mockReturnValue(users)

    const { getUsersAction } = await import('./user-server-actions')
    const result = await getUsersAction()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
  })
})
