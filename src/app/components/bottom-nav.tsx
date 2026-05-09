'use client'

import Link from 'next/link'

interface BottomNavProps {
  activeTab: string
}

const TABS = [
  { id: 'WORKOUT', label: 'WORKOUT', icon: 'fitness_center', href: '/today' },
  { id: 'HISTORY', label: 'HISTORY', icon: 'calendar_today', href: '/history' },
  { id: 'PROGRESS', label: 'PROGRESS', icon: 'monitoring', href: '/progress' },
  { id: 'PROFILE', label: 'PROFILE', icon: 'settings', href: '/profile' },
  { id: 'CONFIG', label: 'CONFIG', icon: 'settings', href: '/config' },
]

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <footer className="fixed bottom-0 left-0 z-50 w-full border-t-4 border-on-surface bg-background shadow-[0px_-4px_0px_0px_rgba(27,29,14,1)]" id="bottom-nav">
      <div className="w-full max-w-4xl px-6 py-3">
        <nav className="flex w-full justify-around border-t-4 border-on-surface" id="nav-tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center px-4 py-2 transition-all active:scale-95 ${
                activeTab === tab.id
                  ? 'border-x-4 border-on-surface bg-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] text-on-primary'
                  : 'hover:bg-surface-container-highest text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="font-label-bold text-label-bold uppercase">{tab.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
