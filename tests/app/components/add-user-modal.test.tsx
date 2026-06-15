import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddUserModal from '@/app/components/add-user-modal'

vi.mock('@/features/user/user-server-actions', () => ({
  createUserAction: vi.fn(),
}))

function getMock() {
  return require('@/features/user/user-server-actions')
}

function renderModal() {
  const onCreated = vi.fn()
  const { container } = render(<AddUserModal onCreated={onCreated} />)
  return { onCreated, container }
}

describe('AddUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the add button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('does not render modal overlay initially', () => {
    renderModal()
    expect(screen.queryByText('NEW COMMANDER')).not.toBeInTheDocument()
  })

  it('opens modal when add button is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText('NEW COMMANDER')).toBeInTheDocument()
  })

  it('renders name input', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByPlaceholderText('Commander name')).toBeInTheDocument()
  })

  it('renders cancel button', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeInTheDocument()
  })

  it('renders submit button with correct text', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByRole('button', { name: 'ADD COMMANDER' })).toBeInTheDocument()
  })

  it('submit button is disabled when name is empty', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is enabled when name is filled', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })
    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).not.toBeDisabled()
  })

  it('closes modal when cancel button is clicked', () => {
    const { onCreated } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(screen.queryByText('NEW COMMANDER')).not.toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('closes modal when overlay is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const overlay = document.getElementById('add-user-modal-overlay')
    expect(overlay).toBeInTheDocument()
    fireEvent.click(overlay!)
    expect(screen.queryByText('NEW COMMANDER')).not.toBeInTheDocument()
  })

  it('does not close modal when card is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const card = document.getElementById('add-user-modal')
    expect(card).toBeInTheDocument()
    fireEvent.click(card!)
    expect(screen.getByText('NEW COMMANDER')).toBeInTheDocument()
  })

  it('calls createUserAction on form submit', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith('Alice')
    })
  })

  it('clears form and closes modal on success', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.queryByText('NEW COMMANDER')).not.toBeInTheDocument()
    })
  })

  it('displays error message on failure', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: false, error: 'User already exists' })

    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.getByText('User already exists')).toBeInTheDocument()
    })
  })

  it('does not close modal on error', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: false, error: 'User already exists' })

    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.getByText('NEW COMMANDER')).toBeInTheDocument()
    })
  })

  it('calls onCreated callback on success', async () => {
    const { onCreated } = renderModal()
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
    })
  })

  it('sets creating state while submitting', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, user: { id: { value: 1 }, name: 'Alice' } }), 50)),
    )

    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '...' })).toBeInTheDocument()
    })
  })

  it('does not submit when name is empty', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).toBeDisabled()
  })
})
