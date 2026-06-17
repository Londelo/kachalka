'use client'

import { useState } from 'react'
import Header from '@/app/components/header'
import SideDrawer from '@/app/components/side-drawer'
import LoadingProviderClient from '@/app/components/loading-provider.client'
import LoadingScreen from '@/app/components/loading-screen'

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const onMenuToggle = () => setIsDrawerOpen((prev) => !prev)

  return (
    <>
      <Header isDrawerOpen={isDrawerOpen} onMenuToggle={onMenuToggle} />
      <LoadingProviderClient>
        <main id="app-main">{children}</main>
        <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        <LoadingScreen />
      </LoadingProviderClient>
    </>
  )
}
