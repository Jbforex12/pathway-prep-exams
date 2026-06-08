'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Download } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Spinner } from '@/components/ui-bits'
import {
  ApiError,
  adminAttempts,
  adminExhaustedExams,
  adminRescheduleExam,
  adminResendCertificate,
  type AttemptAdminRow,
  type ExhaustedExamRow,
} from '@/lib/exam-api'

export default function AdminAttemptsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState<AttemptAdminRow[]>([])
  const [exhausted, setExhausted] = useState<ExhaustedExamRow[]>([])
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [sendingCertId, setSendingCertId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([adminAttempts(), adminExhaustedExams()])
      .then(([attemptsRes, exhaustedRes]) => {
        setAttempts(attemptsRes.attempts)
        setExhausted(exhaustedRes.exhausted)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  async function sendCertificate(attemptId: string, label: string) {
    setSendingCertId(attemptId)
    setMessage('')
    try {
      await adminResendCertificate(attemptId)
      setMessage(`Certificate sent: ${label}`)
      await load()
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Certificate send failed.')
    } finally {
      setSendingCertId(null)
    }
  }

  async function reschedule(row: ExhaustedExamRow) {
    const key = `${row.candidate_id}:${row.exam_id}`
    const label = `${row.candidate_name || row.candidate_email} — ${row.exam_title}`
    if (
      !window.confirm(
        `Reschedule this exam for ${label}?\n\nThey will get ${row.attemptsMax} fresh attempts. Previous attempts stay on record.`,
      )
    ) {
      return
    }
    setReschedulingId(key)
    setMessage('')
    try {
      await adminRescheduleExam({ exam_id: row.exam_id, candidate_id: row.candidate_id })
      setMessage(`Rescheduled: ${label}`)
      await load()
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Reschedule failed.')
    } finally {
      setReschedulingId(null)
    }
  }

  return (
    <AdminShell
      title="Attempts"
      subtitle="Submitted exam attempts, scores, and rescheduling when learners have used both tries."
      actions={
        <a
          href="/api/exam/admin/attempts/export"
          className="touch-target inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:border-primary/40"
        >
          <Download className="size-4" />
          Export CSV
        </a>
      }
    >
      {message ? (
        <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">{message}</p>
      ) : null}

      <section className="mb-8">
        <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">Reschedule exam</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Candidates who used both attempts without passing. Rescheduling grants two new tries.
        </p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : exhausted.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No candidates waiting for a reschedule.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {exhausted.map((row) => {
              const key = `${row.candidate_id}:${row.exam_id}`
              const busy = reschedulingId === key
              return (
                <div
                  key={key}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">{row.candidate_name || 'Unknown student'}</p>
                    <p className="text-xs text-muted-foreground break-all">{row.candidate_email}</p>
                    <p className="mt-2 text-sm break-words">{row.exam_title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Attempts used: {row.attemptsUsed}/{row.attemptsMax}
                      {row.last_reset_at
                        ? ` · Last rescheduled ${new Date(row.last_reset_at).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reschedule(row)}
                    className="touch-target inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:h-10"
                  >
                    {busy ? <Spinner className="size-4" /> : <CalendarClock className="size-4" />}
                    Reschedule
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">All submitted attempts</h2>
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-3 md:hidden">
              {attempts.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium break-words">{a.candidate_name}</p>
                  <p className="text-xs text-muted-foreground break-all">{a.candidate_email}</p>
                  <p className="mt-2 text-sm break-words">{a.exam_title}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xl font-bold text-primary">{a.score_percent}%</span>
                    <span className={a.passed ? 'text-success' : 'text-destructive'}>
                      {a.passed ? 'Passed' : 'Failed'}
                      {a.submit_reason === 'tab_switch' ? ' · Integrity' : ''}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                  </p>
                  {a.passed && !a.certificate_sent_at ? (
                    <button
                      type="button"
                      disabled={sendingCertId === a.id}
                      onClick={() =>
                        sendCertificate(a.id, `${a.candidate_name || a.candidate_email} — ${a.exam_title}`)
                      }
                      className="mt-3 touch-target inline-flex h-10 items-center justify-center rounded-lg border border-primary px-3 text-sm font-semibold text-primary disabled:opacity-60"
                    >
                      {sendingCertId === a.id ? 'Sending…' : 'Send certificate'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-3 hidden overflow-hidden rounded-xl border border-border bg-card md:block">
              <div className="mobile-scroll-x md:overflow-visible md:p-0">
                <table className="min-w-[900px] w-full text-left text-sm md:min-w-0">
                  <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Exam</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Certificate</th>
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
                        <td className="px-4 py-3">
                          {a.passed ? 'Passed' : 'Failed'}
                          {a.submit_reason === 'tab_switch' ? (
                            <span className="ml-1 text-xs text-destructive">(tab switch)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {a.passed ? (
                            a.certificate_sent_at ? (
                              <span className="text-xs text-success">Sent</span>
                            ) : (
                              <button
                                type="button"
                                disabled={sendingCertId === a.id}
                                onClick={() =>
                                  sendCertificate(
                                    a.id,
                                    `${a.candidate_name || a.candidate_email} — ${a.exam_title}`,
                                  )
                                }
                                className="text-sm font-semibold text-primary disabled:opacity-60"
                              >
                                {sendingCertId === a.id ? 'Sending…' : 'Send certificate'}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </AdminShell>
  )
}
