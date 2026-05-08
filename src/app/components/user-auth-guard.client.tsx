'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UserAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    const match = document.cookie.match(/kachalka\.userId=(\d+)/)
    if (!match) {
      router.push('/')
    }
  }, [router])

  return null
}
