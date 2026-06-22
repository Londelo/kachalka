'use client'

import { ReactNode } from 'react'
import { LoadingProvider as LC } from '@/components/loading-context'

export default function LoadingProviderClient({ children }: { children: ReactNode }) {
  return <LC>{children}</LC>
}
