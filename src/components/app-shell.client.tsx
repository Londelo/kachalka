'use client'

import { useState } from 'react'
import Header from '@/components/header'
import SideDrawer from '@/components/side-drawer'
import type { ReactNode } from 'react'

export default function AppShell({ children }: { children: ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const onMenuToggle = () => setIsDrawerOpen((prev) => !prev)

  return (
    <>
      <Header onMenuToggle={onMenuToggle} />
      {children}
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  )
}
