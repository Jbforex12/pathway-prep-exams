'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Spinner } from '@/components/ui-bits'
import { ADMIN_WIPE_CONFIRM_PHRASE, ApiError, adminStats, adminWipePlatform } from '@/lib/exam-api'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ exams: 0, published: 0, attempts: 0, passed: 0 })
  const [wipePhrase, setWipePhrase] = useState('')
  const [wiping, setWiping] = useState(false)
  const [wipeMessage, setWipeMessage] = useState('')
  const [wipeError, setWipeError] = useState('')

  useEffect(() => {
    adminStats()
      .then(setStats)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [router])

  return (
    <AdminShell title="Overview" subtitle="Manage CBT exams, questions, and learner attempts.">
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Exams', stats.exams],
              ['Published', stats.published],
              ['Attempts', stats.attempts],
              ['Passed', stats.passed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/admin/exams/"
              className="touch-target inline-flex h-12 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:h-auto"
            >
              Manage exams
            </Link>
            <Link
              href="/admin/attempts/"
              className="touch-target inline-flex h-12 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium sm:h-auto"
            >
              View attempts
            </Link>
          </div>

          <section className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-destructive">Go-live reset</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Removes every exam, question set, attempt, and registered candidate. Training partner accounts and
              activation codes stay; used codes become available again.
            </p>
            <label className="mt-4 block text-sm font-medium" htmlFor="wipe-confirm">
              Type <span className="font-mono text-xs">{ADMIN_WIPE_CONFIRM_PHRASE}</span> to confirm
            </label>
            <input
              id="wipe-confirm"
              value={wipePhrase}
              onChange={(e) => setWipePhrase(e.target.value)}
              className="mt-2 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
              autoComplete="off"
            />
            {wipeError ? <p className="mt-2 text-sm text-destructive">{wipeError}</p> : null}
            {wipeMessage ? <p className="mt-2 text-sm text-primary">{wipeMessage}</p> : null}
            <button
              type="button"
              disabled={wiping || wipePhrase !== ADMIN_WIPE_CONFIRM_PHRASE}
              onClick={async () => {
                if (
                  !window.confirm(
                    'Permanently delete all exams, questions, attempts, and candidates? This cannot be undone.',
                  )
                ) {
                  return
                }
                setWiping(true)
                setWipeError('')
                setWipeMessage('')
                try {
                  const res = await adminWipePlatform(wipePhrase)
                  setWipeMessage(res.message)
                  setWipePhrase('')
                  const fresh = await adminStats()
                  setStats(fresh)
                } catch (err) {
                  setWipeError(err instanceof ApiError ? err.message : 'Reset failed.')
                } finally {
                  setWiping(false)
                }
              }}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {wiping ? 'Resetting…' : 'Reset platform for go-live'}
            </button>
          </section>
        </>
      )}
    </AdminShell>
  )
}
