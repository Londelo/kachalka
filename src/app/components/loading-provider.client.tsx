'use client'

import { LoadingProvider as LC, ReactNode } from '@/app/components/loading-context'

export default function LoadingProviderClient({ children }: { children: ReactNode }) {
  return <LC>{children}</LC>
}
