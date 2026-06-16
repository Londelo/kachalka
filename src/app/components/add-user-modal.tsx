'use client'

import { useState } from 'react'
import { createUserAction } from '@/features/user/user-server-actions'

interface AddUserModalProps {
  onCreated?: () => Promise<void>
}

export default function AddUserModal({ onCreated }: AddUserModalProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return

    setCreating(true)
    setError(null)

    const result = await createUserAction(name)

    if (result.success) {
      setOpen(false)
      setName('')
      await onCreated?.()
    } else {
      setError(result.error ?? 'Failed to create user')
    }

    setCreating(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-12 items-center justify-center border-4 border-on-surface bg-red-500 text-headline-sm font-headline-sm uppercase text-on-surface transition-all active-press"
        id="add-user-button"
      >
        <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
          add
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          id="add-user-modal-overlay"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Create new commander"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm border-4 border-on-surface bg-surface-container-high p-6 neo-shadow"
            id="add-user-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-headline-md text-headline-md font-black uppercase text-on-surface">
              NEW COMMANDER
            </h3>

            {error && (
              <div
                id="add-user-error"
                className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate()
              }}
              className="flex flex-col gap-3"
              id="add-user-form"
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Commander name"
                maxLength={100}
                autoFocus
                className="flex-1 border-4 border-on-surface bg-surface px-3 py-2 font-label-mono text-label-mono"
                id="add-user-name-input"
              />
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="border-4 border-on-surface bg-primary px-4 py-2 font-label-bold text-label-bold uppercase text-on-primary transition-all active-press disabled:opacity-50"
                id="add-user-submit"
              >
                {creating ? '...' : 'ADD COMMANDER'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors"
              id="add-user-cancel"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
