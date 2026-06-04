'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface LoadingContextValue {
  pages: Set<string>
  start: (key: string) => void
  end: (key: string) => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Set<string>>(new Set())

  const start = useCallback((key: string) => {
    setPages((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const end = useCallback((key: string) => {
    setPages((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  return (
    <LoadingContext.Provider value={{ pages, start, end }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider')
  const { start, end, pages } = ctx
  return { start, end, loading: pages.size > 0 }
}
