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
  email: 'alice@example.com',
}

vi.mock('@/config/db', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

vi.mock('@/features/user/user-repo-impl', () => ({
  createSqliteUserRepository: vi.fn(() => mockRepo),
}))

vi.mock('@/features/user/create-user', () => ({
  createUserUseCase: vi.fn(() => mockCreateUser),
}))

vi.mock('@/features/user/get-users', () => ({
  getUsersUseCase: vi.fn(() => mockGetUsers),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateUser.execute.mockReset()
  mockGetUsers.execute.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('createUserAction', () => {
  it('returns success with user on valid name and email', async () => {
    mockCreateUser.execute.mockReturnValue(mockUser)

    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', 'alice@example.com')

    expect(result.success).toBe(true)
    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeUndefined()
  })

  it('passes name and email to use case', async () => {
    mockCreateUser.execute.mockReturnValue(mockUser)

    const { createUserAction } = await import('@/features/user/user-server-actions')
    await createUserAction('Alice', 'alice@example.com')

    expect(mockCreateUser.execute).toHaveBeenCalledWith('Alice', 'alice@example.com')
  })

  it('returns failure when user already exists', async () => {
    mockCreateUser.execute.mockImplementation(() => {
      throw new Error('User already exists')
    })

    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', 'alice@example.com')

    expect(result.success).toBe(false)
    expect(result.error).toBe('User already exists')
    expect(result.user).toBeUndefined()
  })

  it('returns failure for empty name', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('', 'alice@example.com')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Name is required')
  })

  it('returns failure for empty email', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', '')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Email is required')
  })

  it('returns failure for whitespace-only email', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', '   ')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Email is required')
  })

  it('returns internal error message on database failure', async () => {
    mockCreateUser.execute.mockImplementation(() => {
      throw new Error('Connection refused: ECONNREFUSED')
    })

    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', 'alice@example.com')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused: ECONNREFUSED')
  })

  it('returns failure for non-string name input', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction(null as unknown as string, 'alice@example.com')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Name is required')
  })

  it('returns failure for non-string email input', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    const result = await createUserAction('Alice', 123 as unknown as string)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Email is required')
  })
})

describe('getUsersAction', () => {
  it('returns user list on success', async () => {
    mockGetUsers.execute.mockReturnValue([mockUser])

    const { getUsersAction } = await import('@/features/user/user-server-actions')
    const result = await getUsersAction()

    expect(result).toEqual([mockUser])
  })

  it('returns empty array when no users exist', async () => {
    mockGetUsers.execute.mockReturnValue([])

    const { getUsersAction } = await import('@/features/user/user-server-actions')
    const result = await getUsersAction()

    expect(result).toEqual([])
  })

  it('returns multiple users', async () => {
    const users = [
      { id: { value: 1 }, name: 'Alice', email: 'alice@example.com' },
      { id: { value: 2 }, name: 'Bob', email: 'bob@example.com' },
    ]
    mockGetUsers.execute.mockReturnValue(users)

    const { getUsersAction } = await import('@/features/user/user-server-actions')
    const result = await getUsersAction()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
  })
})
