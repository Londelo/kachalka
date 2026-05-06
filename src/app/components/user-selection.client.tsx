'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserAction, getUsersAction } from '@/features/user/user-server-actions'

interface UserSelectionClientProps {
  initialUsers: { id: { value: number }; name: string }[]
}

export default function UserSelectionClient({
  initialUsers,
}: UserSelectionClientProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState(initialUsers)

  async function handleCreate() {
    const result = await createUserAction(name)

    if (result.success && result.user) {
      setCookie('kachalka.userId', String(result.user.id.value))
      router.push('/today')
    } else {
      setError(result.error ?? 'Failed to create user')
    }
  }

  function handleSelect(userId: number): void {
    setCookie('kachalka.userId', String(userId))
    router.push('/today')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Select your user</h1>

      {error && (
        <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {users.length > 0 && (
        <div className="mt-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">Existing users</h2>
          <ul className="space-y-2">
            {users.map((user) => (
              <li key={user.id.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(user.id.value)}
                  className="w-full rounded border px-4 py-2 text-left hover:bg-gray-50"
                >
                  {user.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          handleCreate()
        }}
        className="mt-6 flex gap-2"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New user name"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Add
        </button>
      </form>
    </div>
  )
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
}
