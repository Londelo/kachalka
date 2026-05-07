'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/app/components/bottom-nav'

export default function NavWrapper() {
  const pathname = usePathname()

  let activeTab = 'CONFIG'
  if (pathname?.startsWith('/today')) activeTab = 'WORKOUT'
  else if (pathname?.startsWith('/history')) activeTab = 'HISTORY'
  else if (pathname?.startsWith('/progress')) activeTab = 'PROGRESS'
  else if (pathname?.startsWith('/profile')) activeTab = 'PROFILE'

  return <BottomNav activeTab={activeTab} />
}
