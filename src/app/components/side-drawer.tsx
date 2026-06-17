'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { id: 'WORKOUT', label: 'WORKOUT', icon: 'fitness_center', href: '/today' },
  { id: 'HISTORY', label: 'HISTORY', icon: 'calendar_today', href: '/history' },
  { id: 'PROGRESS', label: 'PROGRESS', icon: 'monitoring', href: '/progress' },
  { id: 'PLAN', label: 'PLAN', icon: 'settings', href: '/plan' },
]

interface SideDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function SideDrawer({ isOpen, onClose }: SideDrawerProps) {
  const pathname = usePathname()

  let activeTab = 'CONFIG'
  if (pathname?.startsWith('/today')) activeTab = 'WORKOUT'
  else if (pathname?.startsWith('/history')) activeTab = 'HISTORY'
  else if (pathname?.startsWith('/progress')) activeTab = 'PROGRESS'
  else if (pathname?.startsWith('/plan')) activeTab = 'PLAN'

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside
        className={`fixed left-0 top-[56px] z-[60] flex h-[calc(100vh-56px)] w-[80vw] flex-col border-r-4 border-on-surface bg-background transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding section */}
        <div className="flex items-center gap-4 border-b-4 border-on-surface px-6 py-3">
          <span className="material-symbols-outlined text-primary">menu</span>
          <h1 className="font-headline-lg text-headline-lg font-black uppercase tracking-tighter text-primary">
            Kachalka
          </h1>
        </div>
        {/* Navigation links */}
        <nav className="flex flex-col">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              onClick={onClose}
              className={`flex items-center gap-4 px-6 py-3 transition-all active:scale-95 ${
                activeTab === tab.id
                  ? 'border-r-4 border-on-surface bg-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] text-on-primary'
                  : 'hover:bg-surface-container-highest text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="font-label-bold text-label-bold uppercase">{tab.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
