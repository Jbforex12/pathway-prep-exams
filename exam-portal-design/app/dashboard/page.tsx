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
import { formatCourse, titleCase } from '@/lib/format'

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

  const submittedAttempts = attempts.filter((a) => a.submitted_at)

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
        <div className="safe-px mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 sm:h-16">
          <PathwayLogo subtitle="Exams" />
          <button
            type="button"
            onClick={signOut}
            className="touch-target inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="safe-px safe-pb mx-auto max-w-4xl py-5 sm:py-8">
        <h1 className="font-heading text-xl font-semibold break-words sm:text-2xl">Welcome, {titleCase(name)}</h1>
        <p className="mt-1 text-sm text-muted-foreground break-words">
          Course: {course ? formatCourse(course) : 'Not set'}
        </p>

        <section className="mt-6 sm:mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">Available exams</h2>
          <div className="mt-3 space-y-3">
            {exams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8">
                No published exams for your course yet.
              </p>
            ) : (
              exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-bold break-words">{exam.title}</h3>
                    {exam.published_at ? (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Updated{' '}
                        {new Date(exam.published_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5 shrink-0" />
                        {exam.duration_minutes} min
                      </span>
                      <span>{exam.question_count} questions</span>
                      <span>Pass: {exam.cutoff_percent}%</span>
                      <span>
                        Attempts: {exam.attemptsUsed ?? 0}/{exam.attemptsMax ?? 2}
                      </span>
                    </div>
                  </div>
                  {exam.canTake === false ? (
                    <span className="text-center text-sm font-medium text-muted-foreground sm:text-right">
                      No attempts left
                    </span>
                  ) : (
                    <Link
                      href={`/exam/?id=${encodeURIComponent(exam.id)}`}
                      className="touch-target inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:h-10 sm:w-auto"
                    >
                      <PlayCircle className="size-4" />
                      {(exam.attemptsUsed ?? 0) > 0 ? 'Retake exam' : 'Start exam'}
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {submittedAttempts.length > 0 ? (
          <section className="mt-8 sm:mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">Your results</h2>

            <div className="mt-3 space-y-3 md:hidden">
              {submittedAttempts.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium break-words">{a.exam_title}</p>
                  <p className="mt-2 text-2xl font-bold text-primary">{a.score_percent}%</p>
                  <Link
                    href={`/result/?id=${encodeURIComponent(a.id)}`}
                    className="mt-3 inline-flex text-sm font-medium text-primary"
                  >
                    {a.passed ? 'Passed' : 'Failed'} — view result
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-3 hidden overflow-hidden rounded-xl border border-border bg-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedAttempts.map((a) => (
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
