'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
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
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!session || submitting) return
      if (!auto && !confirm('Submit your exam? You cannot change answers after submitting.')) return
      setSubmitting(true)
      try {
        await submitExam(session.attemptId)
        router.replace(`/result/?id=${encodeURIComponent(session.attemptId)}`)
      } catch (err) {
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
    if (!session || secondsLeft <= 0) return
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          void handleSubmit(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [session, secondsLeft, handleSubmit])

  const questions = session?.questions || []
  const current = questions[index]
  const progress = questions.length ? `${index + 1} / ${questions.length}` : '0 / 0'
  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [secondsLeft])

  async function pickOption(optionIndex: number) {
    if (!session || !current) return
    const next = { ...answers, [current.id]: optionIndex }
    setAnswers(next)
    await saveAnswer(session.attemptId, current.id, optionIndex)
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
      <header className="safe-pt sticky top-0 z-10 border-b border-border bg-card">
        <div className="safe-px mx-auto flex h-14 max-w-3xl items-center justify-between text-sm">
          <span className="font-medium">{session.examTitle}</span>
          <span className="font-mono font-semibold text-primary">{timerLabel}</span>
          <span className="text-muted-foreground">Q {progress}</span>
        </div>
      </header>

      <main className="safe-px safe-pb mx-auto max-w-3xl py-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Question {index + 1} · {questionTypeLabel(current?.question_type)}
          </p>
          <h2 className="mt-3 text-lg font-medium leading-relaxed">{current?.prompt}</h2>
          <div className={`mt-6 gap-3 ${current?.options.length === 2 ? 'grid sm:grid-cols-2' : 'space-y-3'}`}>
            {current?.options.map((opt, i) => {
              const selected = answers[current.id] === i
              const label =
                (current?.options.length || 0) <= 6 ? String.fromCharCode(65 + i) : String(i + 1)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickOption(i)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
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

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-4 text-sm disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-4 text-sm"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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
