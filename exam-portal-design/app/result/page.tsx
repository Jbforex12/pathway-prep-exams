'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Award, CheckCircle2, XCircle } from 'lucide-react'
import { Spinner } from '@/components/ui-bits'
import { ApiError, getResult, type ExamResult } from '@/lib/exam-api'

function ResultInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('id') || ''
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ExamResult | null>(null)

  useEffect(() => {
    if (!attemptId) return
    getResult(attemptId)
      .then(setResult)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/')
      })
      .finally(() => setLoading(false))
  }, [attemptId, router])

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
      </main>
    )
  }

  if (!result) {
    return (
      <main className="safe-px flex min-h-dvh items-center justify-center">
        <p>Result not found.</p>
      </main>
    )
  }

  return (
    <main className="safe-px safe-pb flex min-h-dvh items-center justify-center bg-muted/30 py-6 sm:py-10">
      <div className="page-card w-full max-w-lg text-center shadow-sm sm:p-8">
        {result.passed ? (
          <CheckCircle2 className="mx-auto size-12 text-success" />
        ) : (
          <XCircle className="mx-auto size-12 text-destructive" />
        )}
        <h1 className="mt-4 font-heading text-2xl font-semibold">{result.passed ? 'Congratulations!' : 'Exam complete'}</h1>
        <p className="mt-2 text-muted-foreground">{result.examTitle}</p>
        <p className="mt-6 text-4xl font-bold text-primary sm:text-5xl">{result.scorePercent}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.correct} of {result.total} correct · Pass mark {result.cutoffPercent}%
        </p>
        {result.attemptNumber ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Attempt {result.attemptNumber} of {result.attemptsMax ?? 2}
          </p>
        ) : null}
        {result.passed && result.certificateSent ? (
          <p className="mt-4 inline-flex items-center justify-center gap-2 text-sm text-success">
            <Award className="size-4" />
            Certificate sent to your email
          </p>
        ) : null}
        {result.passed && !result.certificateSent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Your certificate is being prepared. Refresh this page in a moment, or contact your training partner if it
            does not arrive.
          </p>
        ) : null}
        {!result.passed && result.resultEmailSent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            A summary of your result has been sent to your email.
          </p>
        ) : null}
        {result.canRetake ? (
          <p className="mt-4 text-sm text-muted-foreground">You have one retake available from your dashboard.</p>
        ) : null}
        <Link
          href="/dashboard/"
          className="touch-target mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground sm:h-10 sm:w-auto"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}

export default function ResultPage() {
  return (
    <Suspense>
      <ResultInner />
    </Suspense>
  )
}
