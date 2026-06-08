'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdminShell } from '@/components/admin-shell'
import { Spinner } from '@/components/ui-bits'
import { ApiError, adminStats } from '@/lib/exam-api'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ exams: 0, published: 0, attempts: 0, passed: 0 })

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
        </>
      )}
    </AdminShell>
  )
}
