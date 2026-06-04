'use client'

import { useLoading } from '@/app/components/loading-context'

export default function LoadingScreen() {
  const { loading } = useLoading()

  if (!loading) return null

  return (
    <div className="fixed inset-x-0 top-[60px] z-[45] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span
          className="material-symbols-outlined text-[64px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          hourglass_top
        </span>
        <span className="font-label-bold text-label-bold uppercase text-on-surface">
          LOADING...
        </span>
      </div>
    </div>
  )
}
