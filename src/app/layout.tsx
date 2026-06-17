import type { ReactNode } from 'react'
import './globals.css'
import { runMigrations } from '@/db/migrate'
import { seedDatabase, seedProgressData } from '@/db/seed'
import Header from '@/app/components/header'
import NavWrapper from '@/app/components/nav-wrapper.client'
import LoadingProviderClient from '@/app/components/loading-provider.client'
import LoadingScreen from '@/app/components/loading-screen'

export const metadata = {
  title: 'Kachalka',
  description: 'Track your weightlifting workouts',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  runMigrations()
  seedDatabase()
  seedProgressData()
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700;800;900&family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body-md">
        <Header />
        <LoadingProviderClient>
          <main id="app-main">{children}</main>
          <NavWrapper />
          <LoadingScreen />
        </LoadingProviderClient>
      </body>
    </html>
  )
}
