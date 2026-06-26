import type { ReactNode } from 'react'
import './globals.css'

export const dynamic = 'force-dynamic'
import { validateEnv } from '@/config/env'
import { runMigrations } from '@/db/migrate'
import AppShell from '@/components/app-shell.client'
import LoadingProviderClient from '@/components/loading-provider.client'
import LoadingScreen from '@/components/loading-screen'

export const metadata = {
  title: 'Kachalka',
  description: 'Track your weightlifting workouts',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  validateEnv()
  runMigrations()

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
        <AppShell>
          <LoadingProviderClient>
            <main id="app-main">{children}</main>
            <LoadingScreen />
          </LoadingProviderClient>
        </AppShell>
      </body>
    </html>
  )
}
