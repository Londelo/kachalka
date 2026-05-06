'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserAction } from '@/features/user/user-server-actions'

interface BottomNavProps {
  activeTab: string
}

const TABS = [
  { id: 'WORKOUT', label: 'WORKOUT', icon: 'fitness_center' },
  { id: 'HISTORY', label: 'HISTORY', icon: 'calendar_today' },
  { id: 'PROGRESS', label: 'PROGRESS', icon: 'monitoring' },
  { id: 'CONFIG', label: 'CONFIG', icon: 'settings' },
]

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <footer className="fixed bottom-0 left-0 z-50 w-full border-t-4 border-on-surface bg-background shadow-[0px_-4px_0px_0px_rgba(27,29,14,1)]">
      <div className="w-full max-w-4xl px-6 py-3">
        <NewRecruitButton />
        <nav className="flex w-full justify-around border-t-4 border-on-surface">
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className={`flex flex-col items-center justify-center px-4 py-2 transition-all active:scale-95 ${
                tab.id === activeTab
                  ? 'border-x-4 border-on-surface bg-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] text-on-primary'
                  : 'hover:bg-surface-container-highest text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="font-label-bold text-label-bold uppercase">{tab.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  )
}

function NewRecruitButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const result = await createUserAction(name)

    if (result.success && result.user) {
      setCookie('kachalka.userId', String(result.user.id.value))
      router.push('/today')
    } else {
      setError(result.error ?? 'Failed to create user')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-4 border-4 border-on-surface bg-primary py-3 text-headline-md font-headline-md uppercase font-bold text-on-primary transition-all neo-shadow-sm active-press"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          person_add
        </span>
        NEW RECRUIT
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm border-4 border-on-surface bg-surface-container-high p-6 neo-shadow">
        <h3 className="mb-4 font-headline-md text-headline-md font-black uppercase text-on-surface">
          NEW RECRUIT
        </h3>

        {error && (
          <p className="mb-3 rounded border-2 border-error bg-error-container p-2 text-sm text-error">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            handleCreate()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recruit name"
            autoFocus
            className="flex-1 border-4 border-on-surface bg-surface px-3 py-2 font-label-mono text-label-mono"
          />
          <button
            type="submit"
            className="border-4 border-on-surface bg-primary px-4 py-2 font-label-bold text-label-bold uppercase text-on-primary transition-all active-press"
          >
            ADD
          </button>
        </form>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 w-full border-2 border-on-surface bg-surface px-3 py-2 font-label-bold text-label-bold uppercase text-on-surface hover:bg-surface-container transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
}
