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
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin/exams/" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Manage exams
            </Link>
            <Link href="/admin/attempts/" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
              View attempts
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  )
}
