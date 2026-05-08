import type { ReactNode } from 'react'
import Header from '@/app/components/header'
import NavWrapper from '@/app/components/nav-wrapper.client'

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <NavWrapper />
    </>
  )
}
