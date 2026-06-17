'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const isSelectUser = pathname === '/'

  return (
    <header
      className="fixed left-0 top-0 z-50 grid h-14 w-full grid-cols-[auto_1fr_auto] items-center border-b-4 border-on-surface bg-background px-6"
      id="app-header"
    >
      {/* Nav button — hidden on select-user page */}
      {!isSelectUser && (
        <button
          onClick={onMenuToggle}
          className="flex items-center gap-2 active:scale-95"
          id="header-nav-btn"
        >
          <span className="material-symbols-outlined text-primary">menu</span>
        </button>
      )}
      {/* Title — always centered */}
      <h1 className="w-full font-headline-lg text-headline-lg font-black uppercase tracking-tighter text-center text-primary">
        Kachalka
      </h1>
      {/* Account button */}
      <Link href="/" className="transition-all active:scale-95" id="header-account-link">
        <span className="material-symbols-outlined text-primary">account_circle</span>
      </Link>
    </header>
  )
}
