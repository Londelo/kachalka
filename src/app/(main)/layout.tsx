import type { ReactNode } from 'react'

export default function MainLayout({ children }: { children: ReactNode }) {
  return <main id="main-layout">{children}</main>
}
