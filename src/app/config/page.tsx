'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteUserAction, getUsersAction } from '@/features/user/user-server-actions'

export default function ConfigPage() {
  const router = useRouter()
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      setLoading(true)
      const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
      const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
      if (!userId) {
        setLoading(false)
        return
      }

      const users = await getUsersAction()
      const user = users.find((u: { id: { value: number }; name: string }) => u.id.value === userId)
      if (user) {
        setUserName(user.name)
      }
      setLoading(false)
    }
    loadUser()
  }, [])

  async function handleDeleteAccount() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
    const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
    if (!userId) return

    const result = await deleteUserAction(userId)
    if (result.success) {
      // Clear the cookie by setting it to expired
      document.cookie = 'kachalka.userId=; Max-Age=0; path=/'
      router.push('/')
    } else {
      setDeleteError(result.error ?? 'Failed to delete account')
    }
  }

  if (loading) {
    return (
      <>
        <main id="config-page-loading" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
          <div className="mb-8 w-full text-center">
            <h1 id="config-title-loading" className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
              CONFIGURATION
            </h1>
            <p className="mt-2 font-label-mono text-label-mono text-on-surface">LOADING CONFIG...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <main id="config-page-main" className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-[100px] pb-[140px]">
        {/* Header */}
        <section id="config-header" className="space-y-xs pt-md">
          <h1 id="config-title-main" className="font-headline-xl text-headline-xl font-black uppercase text-on-surface">
            CONFIGURATION
          </h1>
          <span id="config-badge" className="font-label-bold text-label-bold text-primary bg-on-surface text-background inline-block px-2 py-1">
            COMMAND CENTER
          </span>
        </section>

        {/* Account Section */}
        <section id="account-section" className="mt-6 w-full space-y-4">
          <h2 id="account-title" className="font-label-bold text-label-bold uppercase text-on-surface">ACCOUNT</h2>

          <div id="account-card" className="border-4 border-on-surface bg-background p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                person
              </span>
              <div>
                <p id="operator-label" className="font-label-bold text-label-bold uppercase text-on-surface-variant">OPERATOR</p>
                <p id="operator-name" className="font-headline-md text-headline-md font-black text-on-surface">
                  {userName || 'UNKNOWN OPERATOR'}
                </p>
              </div>
            </div>
          </div>

          {/* Delete Account */}
          <div id="delete-section" className="border-4 border-on-surface bg-error-container p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]">
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="font-label-bold text-label-bold text-error">
                  CONFIRM ACCOUNT DELETION — THIS ACTION IS IRREVERSIBLE
                </p>
                <div className="flex gap-2">
                  <button
                    id="confirm-delete-btn"
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex-1 border-4 border-on-surface bg-error py-3 font-label-bold text-label-bold uppercase text-on-primary shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    CONFIRM DELETE
                  </button>
                  <button
                    id="cancel-delete-btn"
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteError(null)
                    }}
                    className="flex-1 border-4 border-on-surface bg-background py-3 font-label-bold text-label-bold uppercase text-on-surface shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    CANCEL
                  </button>
                </div>
                {deleteError && (
                  <p className="font-label-bold text-label-bold text-error">{deleteError}</p>
                )}
              </div>
            ) : (
              <button
                id="delete-account-btn"
                type="button"
                onClick={handleDeleteAccount}
                className="w-full border-4 border-on-surface bg-error py-3 font-label-bold text-label-bold uppercase text-on-primary shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                DELETE ACCOUNT
              </button>
            )}
          </div>
        </section>

        {/* Quick Links Section */}
        <section id="quick-links-section" className="mt-6 w-full space-y-4">
          <h2 id="quick-links-title" className="font-label-bold text-label-bold uppercase text-on-surface">QUICK LINKS</h2>

          <Link
            id="profile-link"
            href="/profile"
            className="flex items-center justify-between border-4 border-on-surface bg-background p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all hover:brightness-110 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                assignment
              </span>
              <div>
                <p className="font-label-bold text-label-bold uppercase text-on-surface">MY BATTLE PLAN</p>
                <p className="font-label-mono text-label-mono text-on-surface-variant">ROUTINE EDITER</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
          </Link>

          <Link
            id="progress-link"
            href="/progress"
            className="flex items-center justify-between border-4 border-on-surface bg-background p-4 shadow-[4px_4px_0px_0px_rgba(27,29,14,1)] transition-all hover:brightness-110 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                show_chart
              </span>
              <div>
                <p className="font-label-bold text-label-bold uppercase text-on-surface">FORCE PROGRESSION</p>
                <p className="font-label-mono text-label-mono text-on-surface-variant">PROGRESS CHART</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
          </Link>
        </section>
      </main>
    </>
  )
}
