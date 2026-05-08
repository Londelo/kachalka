'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NewRecruitButton from '@/app/components/new-recruit-button'
import { createUserAction } from '@/features/user/user-server-actions'

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
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[120px] pb-[140px]">
      <div className="mb-12 w-full text-center">
        <h2 className="font-headline-xl text-headline-xl uppercase text-on-surface">
          SELECT COMMANDER
        </h2>
        <div className="mt-2 h-1 w-full bg-on-surface" />
      </div>

      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
        {users.map((user, index) => (
          <UserCard
            key={user.id.value}
            user={user}
            isActive={index === 0}
            onSelect={() => handleSelect(user.id.value)}
          />
        ))}

        <QuickAddCard />
      </div>

      <div className="mt-8 w-full px-6">
        <NewRecruitButton />
      </div>
    </main>
  )
}

interface UserCardProps {
  user: { id: { value: number }; name: string }
  isActive: boolean
  onSelect: () => void
}

function UserCard({ user, isActive, onSelect }: UserCardProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative cursor-pointer border-4 border-on-surface bg-surface-container-high p-6 neo-shadow transition-all active-press"
    >
      {isActive && (
        <div className="absolute right-0 top-0 border-l-4 border-b-4 border-on-surface bg-primary px-4 py-1 font-label-bold text-label-bold uppercase text-on-primary">
          ACTIVE
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className={`flex h-24 w-24 items-center justify-center border-4 ${isActive ? 'border-primary' : 'border-on-surface'} bg-surface text-3xl font-black uppercase text-on-surface`}>
          {initials}
        </div>
        <div>
          <h3 className="font-headline-lg text-headline-lg uppercase text-on-surface">
            {user.name}
          </h3>
          <p className="font-label-mono text-label-mono font-bold text-primary">
            LVL 1 BEGINNER
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-on-surface p-2">
          <p className="font-label-mono text-[10px] uppercase text-background">
            TOTAL LOAD
          </p>
          <p className="font-label-bold text-headline-md text-background">0 KG</p>
        </div>
        <div className="bg-primary p-2">
          <p className="font-label-mono text-[10px] uppercase text-on-primary">
            MAX SQUAT
          </p>
          <p className="font-label-bold text-headline-md text-on-primary">0 KG</p>
        </div>
      </div>
    </button>
  )
}

function QuickAddCard() {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center justify-center border-4 border-dashed border-on-surface bg-surface-variant p-6 neo-shadow transition-colors hover:bg-on-surface hover:text-background active-press"
    >
      <div className="text-center">
        <span className="material-symbols-outlined mb-2 block text-[48px]">add_circle</span>
        <p className="font-headline-md text-headline-md uppercase">QUICK ADD</p>
      </div>
    </button>
  )
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`
}
