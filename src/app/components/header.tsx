'use client'

import Link from 'next/link'

interface HeaderProps {
  isDrawerOpen: boolean
  onMenuToggle: () => void
}

export default function Header({ isDrawerOpen, onMenuToggle }: HeaderProps) {
  return (
    <button
      onClick={onMenuToggle}
      className="fixed left-0 top-0 z-50 flex h-14 w-full items-center justify-between border-b-4 border-on-surface bg-background px-6"
      id="app-header"
    >
      <div className="flex items-center gap-4" id="header-branding">
        <span className="material-symbols-outlined text-primary">menu</span>
        <h1 className="font-headline-lg text-headline-lg font-black uppercase tracking-tighter text-primary">
          Kachalka
        </h1>
      </div>
      <div
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        <Link href="/" className="transition-all active:scale-95" id="header-account-link">
          <span className="material-symbols-outlined text-primary">account_circle</span>
        </Link>
      </div>
    </button>
  )
}
