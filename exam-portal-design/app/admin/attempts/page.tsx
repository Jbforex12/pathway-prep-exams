'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminShell } from '@/components/admin-shell'
import { Spinner } from '@/components/ui-bits'
import { ApiError, adminAttempts, type AttemptAdminRow } from '@/lib/exam-api'

export default function AdminAttemptsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<AttemptAdminRow[]>([])

  useEffect(() => {
    adminAttempts()
      .then((r) => setAttempts(r.attempts))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [router])

  return (
    <AdminShell title="Attempts" subtitle="Submitted exam attempts and scores.">
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {attempts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium break-words">{a.candidate_name}</p>
                <p className="text-xs text-muted-foreground break-all">{a.candidate_email}</p>
                <p className="mt-2 text-sm break-words">{a.exam_title}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xl font-bold text-primary">{a.score_percent}%</span>
                  <span className={a.passed ? 'text-success' : 'text-destructive'}>
                    {a.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <div className="mobile-scroll-x md:overflow-visible md:p-0">
              <table className="min-w-[720px] w-full text-left text-sm md:min-w-0">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.candidate_name}</div>
                        <div className="text-xs text-muted-foreground">{a.candidate_email}</div>
                      </td>
                      <td className="px-4 py-3">{a.exam_title}</td>
                      <td className="px-4 py-3">{a.score_percent}%</td>
                      <td className="px-4 py-3">{a.passed ? 'Passed' : 'Failed'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  )
}
