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
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
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
      )}
    </AdminShell>
  )
}
