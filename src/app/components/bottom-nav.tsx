'use client'

import NewRecruitButton from '@/app/components/new-recruit-button'

interface BottomNavProps {
  activeTab: string
}

const TABS = [
  { id: 'WORKOUT', label: 'WORKOUT', icon: 'fitness_center' },
  { id: 'HISTORY', label: 'HISTORY', icon: 'calendar_today' },
  { id: 'PROGRESS', label: 'PROGRESS', icon: 'monitoring' },
  { id: 'PROFILE', label: 'PROFILE', icon: 'badge' },
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
