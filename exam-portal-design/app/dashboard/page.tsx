'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, PlayCircle } from 'lucide-react'
import { PathwayLogo } from '@/components/logo'
import { Spinner } from '@/components/ui-bits'
import {
  ApiError,
  studentAttempts,
  studentExams,
  studentLogout,
  studentMe,
  type AttemptRow,
  type ExamRow,
} from '@/lib/exam-api'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [course, setCourse] = useState('')
  const [exams, setExams] = useState<ExamRow[]>([])
  const [attempts, setAttempts] = useState<AttemptRow[]>([])

  useEffect(() => {
    Promise.all([studentMe(), studentExams(), studentAttempts()])
      .then(([me, ex, at]) => {
        setName(me.name)
        setCourse(me.course_name)
        setExams(ex.exams)
        setAttempts(at.attempts)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/')
      })
      .finally(() => setLoading(false))
  }, [router])

  async function signOut() {
    await studentLogout()
    router.replace('/')
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Spinner className="size-6" />
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="safe-pt border-b border-border bg-card">
        <div className="safe-px mx-auto flex h-16 max-w-4xl items-center justify-between">
          <PathwayLogo subtitle="Exams" />
          <button type="button" onClick={signOut} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </header>
      <main className="safe-px safe-pb mx-auto max-w-4xl py-8">
        <h1 className="font-heading text-2xl font-semibold">Welcome, {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Course: {course || 'Not set'}</p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">Available exams</h2>
          <div className="mt-3 space-y-3">
            {exams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No published exams for your course yet.
              </p>
            ) : (
              exams.map((exam) => (
                <div key={exam.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div>
                    <h3 className="font-semibold">{exam.title}</h3>
                    <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {exam.duration_minutes} min
                      </span>
                      <span>{exam.question_count} questions</span>
                      <span>Pass: {exam.cutoff_percent}%</span>
                    </p>
                  </div>
                  {exam.completed ? (
                    <span className="text-sm font-medium text-success">Completed</span>
                  ) : (
                    <Link
                      href={`/exam/?id=${encodeURIComponent(exam.id)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      <PlayCircle className="size-4" />
                      Start exam
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {attempts.filter((a) => a.submitted_at).length > 0 ? (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">Your results</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts
                    .filter((a) => a.submitted_at)
                    .map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{a.exam_title}</td>
                        <td className="px-4 py-3">{a.score_percent}%</td>
                        <td className="px-4 py-3">
                          <Link href={`/result/?id=${encodeURIComponent(a.id)}`} className="font-medium text-primary">
                            {a.passed ? 'Passed' : 'Failed'} — view
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
