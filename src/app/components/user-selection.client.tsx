'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NewRecruitButton from '@/app/components/new-recruit-button'

interface UserSelectionClientProps {
  initialUsers: { id: { value: number }; name: string }[]
}

export default function UserSelectionClient({
  initialUsers,
}: UserSelectionClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)

  useEffect(() => {
    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    if (cookieMatch || initialUsers.length === 0) return
    setCookie('kachalka.userId', String(initialUsers[0].id.value))
  }, [initialUsers])

  function handleSelect(userId: number): void {
    setCookie('kachalka.userId', String(userId))
    router.push('/today')
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[120px] pb-[140px]" id="user-selection-main">
      <div className="mb-12 flex w-full items-center justify-between border-b-4 border-on-surface pb-4" id="user-selection-title">
        <div className="flex flex-1 flex-col items-center">
          <h2 className="font-headline-xl text-headline-xl uppercase text-on-surface">
            SELECT COMMANDER
          </h2>
        </div>
        <NewRecruitButton variant="compact" />
      </div>

      <div className="flex w-full flex-col gap-8" id="user-cards-grid">
        {users.map((user) => (
          <UserCard
            key={user.id.value}
            user={user}
            onSelect={() => handleSelect(user.id.value)}
          />
        ))}
      </div>
    </main>
  )
}

interface UserCardProps {
  user: { id: { value: number }; name: string }
  onSelect: () => void
}

function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full cursor-pointer items-center justify-center border-4 border-on-surface bg-surface-container-high py-8 text-3xl font-black uppercase text-on-surface transition-all neo-shadow active-press"
    >
      {user.name}
    </button>
  )
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
}
