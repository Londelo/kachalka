'use client'

import { useState } from 'react'
import { createExerciseAction } from '@/features/exercise/exercise-server-actions'

interface AddExerciseButtonProps {
  label?: string
  onSuccess?: () => void
}

export default function AddExerciseButton({ label, onSuccess }: AddExerciseButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function getUserId(): number {
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    return cookieMatch ? parseInt(cookieMatch[1], 10) : 0
  }

  async function handleCreate() {
    if (!name.trim()) return
    const userId = getUserId()
    if (!userId) {
      setError('No user logged in')
      return
    }

    setCreating(true)
    setError(null)

    const result = await createExerciseAction(name, userId)

    if (result.success) {
      setOpen(false)
      setName('')
      onSuccess?.()
    } else {
      setError(result.error ?? 'Failed to create exercise')
    }

    setCreating(false)
  }

  const buttonClasses =
    'flex w-full items-center justify-center gap-4 border-4 border-on-surface bg-primary py-3 text-headline-md font-headline-md uppercase font-bold text-on-primary transition-all neo-shadow-sm active-press'

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses}
        id="add-exercise-button"
      >
        <div>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            add_circle
          </span>
          {label ?? 'ADD EXERCISE'}
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" id="add-exercise-modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm border-4 border-on-surface bg-surface-container-high p-6 neo-shadow"
            id="add-exercise-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-headline-md text-headline-md font-black uppercase text-on-surface">
              NEW EXERCISE
            </h3>

            {error && (
              <div id="add-exercise-error" className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate()
              }}
              className="flex gap-2"
              id="add-exercise-form"
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Exercise name"
                autoFocus
                className="flex-1 border-4 border-on-surface bg-surface px-3 py-2 font-label-mono text-label-mono"
                id="add-exercise-input"
              />
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="border-4 border-on-surface bg-primary px-4 py-2 font-label-bold text-label-bold uppercase text-on-primary transition-all active-press disabled:opacity-50"
                id="add-exercise-submit"
              >
                {creating ? '...' : 'ADD'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors"
              id="add-exercise-cancel"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
