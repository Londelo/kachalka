import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AddUserModal from '@/components/add-user-modal'

vi.mock('@/features/user/user-server-actions', () => ({
  createUserAction: vi.fn(),
}))

function getMock() {
  return require('@/features/user/user-server-actions')
}

function renderModal({ open = true, onClose = vi.fn(), onCreated = vi.fn() } = {}) {
  const { container } = render(
    <AddUserModal open={open} onClose={onClose} onCreated={onCreated} />,
  )
  return { onCreated, onClose, container }
}

describe('AddUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render overlay when closed', () => {
    renderModal({ open: false })
    expect(screen.queryByText('NEW COMMANDER')).not.toBeInTheDocument()
  })

  it('renders overlay when open', () => {
    renderModal({ open: true })
    expect(screen.getByText('NEW COMMANDER')).toBeInTheDocument()
  })

  it('renders name input', () => {
    renderModal({ open: true })
    expect(screen.getByPlaceholderText('Commander name')).toBeInTheDocument()
  })

  it('renders cancel button', () => {
    renderModal({ open: true })
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeInTheDocument()
  })

  it('renders submit button with correct text', () => {
    renderModal({ open: true })
    expect(screen.getByRole('button', { name: 'ADD COMMANDER' })).toBeInTheDocument()
  })

  it('submit button is disabled when name is empty', () => {
    renderModal({ open: true })
    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is enabled when name is filled', () => {
    renderModal({ open: true })
    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })
    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).not.toBeDisabled()
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ open: true, onClose })
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderModal({ open: true, onClose })
    const overlay = document.getElementById('add-user-modal-overlay')
    expect(overlay).toBeInTheDocument()
    fireEvent.click(overlay!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close modal when card is clicked', () => {
    const onClose = vi.fn()
    renderModal({ open: true, onClose })
    const card = document.getElementById('add-user-modal')
    expect(card).toBeInTheDocument()
    fireEvent.click(card!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls createUserAction on form submit', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    renderModal({ open: true })

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith('Alice')
    })
  })

  it('closes modal on success', async () => {
    const onClose = vi.fn()
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    renderModal({ open: true, onClose })

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('displays error message on failure', async () => {
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: false, error: 'User already exists' })

    renderModal({ open: true })

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.getByText('User already exists')).toBeInTheDocument()
    })
  })

  it('does not close modal on error', async () => {
    const onClose = vi.fn()
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: false, error: 'User already exists' })

    renderModal({ open: true, onClose })

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('calls onCreated callback on success', async () => {
    const onCreated = vi.fn()
    const { createUserAction } = await import('@/features/user/user-server-actions')
    vi.mocked(createUserAction).mockResolvedValue({ success: true, user: { id: { value: 1 }, name: 'Alice' } })

    renderModal({ open: true, onCreated })

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

    renderModal({ open: true })

    const nameInput = screen.getByPlaceholderText('Commander name')
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    fireEvent.click(screen.getByRole('button', { name: 'ADD COMMANDER' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '...' })).toBeInTheDocument()
    })
  })

  it('does not submit when name is empty', () => {
    renderModal({ open: true })
    const submitBtn = screen.getByRole('button', { name: 'ADD COMMANDER' })
    expect(submitBtn).toBeDisabled()
  })
})
