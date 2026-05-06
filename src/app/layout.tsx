import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Kachalka — Lifting Tracker',
  description: 'Track your weightlifting workouts',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b bg-white px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <a href="/" className="text-lg font-bold">Kachalka</a>
            <div className="flex gap-4">
              <a href="/today" className="text-sm text-gray-600 hover:text-gray-900">Today</a>
              <a href="/history" className="text-sm text-gray-600 hover:text-gray-900">History</a>
              <a href="/progress" className="text-sm text-gray-600 hover:text-gray-900">Progress</a>
              <a href="/config" className="text-sm text-gray-600 hover:text-gray-900">Config</a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
