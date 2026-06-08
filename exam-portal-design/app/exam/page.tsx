'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react'
import { Spinner } from '@/components/ui-bits'
import { questionTypeLabel } from '@/lib/exam-data'
import { ApiError, saveAnswer, startExam, submitExam, type ExamSession } from '@/lib/exam-api'

function ExamInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get('id') || ''
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<ExamSession | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [timesUp, setTimesUp] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const submittedRef = useRef(false)

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!session || submitting || submittedRef.current) return
      if (!auto && !confirm('Submit your exam? You cannot change answers after submitting.')) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        await submitExam(session.attemptId)
        router.replace(`/result/?id=${encodeURIComponent(session.attemptId)}`)
      } catch (err) {
        submittedRef.current = false
        setError(err instanceof ApiError ? err.message : 'Submit failed.')
        setSubmitting(false)
      }
    },
    [session, submitting, router],
  )

  const load = useCallback(async () => {
    if (!examId) {
      setError('Missing exam id.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const s = await startExam(examId)
      setSession(s)
      setAnswers(s.answers || {})
      const end = new Date(s.endsAt).getTime()
      setSecondsLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start exam.')
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!session) return
    const end = new Date(session.endsAt).getTime()

    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        setTimesUp(true)
        void handleSubmit(true)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session?.attemptId, session?.endsAt, handleSubmit])

  const questions = session?.questions || []
  const current = questions[index]
  const progress = questions.length ? `${index + 1} / ${questions.length}` : '0 / 0'
  const totalSeconds = (session?.durationMinutes ?? 30) * 60
  const timerPct = totalSeconds > 0 ? Math.min(100, (secondsLeft / totalSeconds) * 100) : 0

  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [secondsLeft])

  const timerUrgent = secondsLeft > 0 && secondsLeft <= 300

  async function pickOption(optionIndex: number) {
    if (!session || !current || submitting || timesUp) return
    const next = { ...answers, [current.id]: optionIndex }
    setAnswers(next)
    await saveAnswer(session.attemptId, current.id, optionIndex)

    if (index < questions.length - 1) {
      window.setTimeout(() => {
        setIndex((i) => Math.min(questions.length - 1, i + 1))
      }, 350)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="safe-px flex min-h-dvh items-center justify-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <p className="font-medium">{error || 'Exam unavailable'}</p>
          <button type="button" onClick={() => router.push('/dashboard/')} className="mt-4 text-sm text-primary">
            Back to dashboard
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      {timesUp && submitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-xl border border-border bg-card px-8 py-6 text-center shadow-lg">
            <Clock className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-semibold">Time&apos;s up</p>
            <p className="mt-1 text-sm text-muted-foreground">Submitting your answers and loading your results…</p>
            <Spinner className="mx-auto mt-4 size-5" />
          </div>
        </div>
      ) : null}

      <header className="safe-pt sticky top-0 z-10 border-b border-border bg-card">
        <div className="safe-px mx-auto max-w-3xl py-3 sm:py-0 sm:h-16 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <p className="min-w-0 truncate text-sm font-medium sm:text-base">{session.examTitle}</p>
          <div className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:justify-end">
            <div className="flex flex-1 flex-col items-center sm:flex-none">
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Time left</span>
              <span
                className={`font-mono text-2xl font-bold tabular-nums sm:text-xl ${timerUrgent ? 'text-destructive' : 'text-primary'}`}
              >
                {timerLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">of {session.durationMinutes} min</span>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm">
              Q {progress}
            </span>
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className={`h-full transition-all duration-1000 ${timerUrgent ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </header>

      <main className="safe-px safe-pb mx-auto max-w-3xl py-4 sm:py-8">
        {timerUrgent && !timesUp ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-center text-sm text-destructive">
            Less than 5 minutes remaining — your exam will auto-submit at 0:00.
          </p>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Question {index + 1} · {questionTypeLabel(current?.question_type)}
          </p>
          <h2 className="mt-3 text-base font-medium leading-relaxed sm:text-lg">{current?.prompt}</h2>
          <div className={`mt-5 gap-3 sm:mt-6 ${current?.options.length === 2 ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-3'}`}>
            {current?.options.map((opt, i) => {
              const selected = answers[current.id] === i
              const label = (current?.options.length || 0) <= 6 ? String.fromCharCode(65 + i) : String(i + 1)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={submitting || timesUp}
                  onClick={() => pickOption(i)}
                  className={`touch-target flex w-full min-h-12 items-start gap-3 rounded-xl border px-4 py-4 text-left text-base transition-colors active:scale-[0.99] disabled:opacity-60 sm:py-3 sm:text-sm ${
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}
                >
                  {(current?.options.length || 0) > 2 ? (
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">
                      {label}
                    </span>
                  ) : null}
                  <span className={current?.options.length === 2 ? 'text-base font-medium' : ''}>{opt}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={index === 0 || submitting || timesUp}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="touch-target inline-flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-border px-4 text-sm disabled:opacity-40 sm:h-10 sm:w-auto"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              disabled={submitting || timesUp}
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="touch-target inline-flex h-12 w-full items-center justify-center gap-1 rounded-lg border border-border px-4 text-sm disabled:opacity-60 sm:h-10 sm:w-auto"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || timesUp}
              onClick={() => handleSubmit(false)}
              className="touch-target inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:h-10 sm:w-auto"
            >
              {submitting ? <Spinner /> : <Send className="size-4" />}
              Submit exam
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ExamPage() {
  return (
    <Suspense>
      <ExamInner />
    </Suspense>
  )
}
