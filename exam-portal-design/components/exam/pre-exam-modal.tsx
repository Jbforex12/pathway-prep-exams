'use client'

import { Clock, FileQuestion, Target, RotateCcw } from 'lucide-react'
import { Spinner } from '@/components/ui-bits'
import type { ExamPreview } from '@/lib/exam-api'

type Props = {
  preview: ExamPreview
  starting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PreExamModal({ preview, starting, onConfirm, onCancel }: Props) {
  const attemptsLeft = Math.max(0, preview.attemptsMax - preview.attemptsUsed)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pre-exam-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 id="pre-exam-title" className="font-heading text-lg font-bold break-words sm:text-xl">
            {preview.examTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Read the instructions before you begin.</p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Clock className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-xs text-muted-foreground">Duration</span>
                <span className="font-semibold">{preview.durationMinutes} min</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <FileQuestion className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-xs text-muted-foreground">Questions</span>
                <span className="font-semibold">{preview.questionCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Target className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-xs text-muted-foreground">Pass mark</span>
                <span className="font-semibold">{preview.cutoffPercent}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <RotateCcw className="size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-xs text-muted-foreground">Attempts left</span>
                <span className="font-semibold">{attemptsLeft}</span>
              </span>
            </div>
          </div>

          {preview.revisedSinceLastAttempt ? (
            <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              This exam was <strong>updated and republished</strong>
              {preview.publishedAt
                ? ` on ${new Date(preview.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                : ''}
              . You will receive the latest questions and settings on this attempt.
            </p>
          ) : null}

          {preview.poolSize > preview.questionCount ? (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Questions are drawn randomly from a bank of {preview.poolSize}. Your set and answer order are unique to
              this attempt.
            </p>
          ) : null}

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm leading-relaxed text-foreground">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Exam integrity notice</p>
            <p className="mt-2 text-muted-foreground">
              By starting this exam, you agree not to share, copy, or distribute any questions. Violation may result in
              disqualification and may affect your registration with your Agent.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>The timer starts only after you click &ldquo;I&apos;m ready&rdquo;</li>
              <li>Your answers are saved automatically — you can refresh without losing progress</li>
              <li>Leaving the exam tab may be recorded; repeated switching can auto-submit your attempt</li>
              <li>Each question page is watermarked with your name for traceability</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            disabled={starting}
            onClick={onCancel}
            className="touch-target h-12 rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-60 sm:h-10"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            disabled={starting || !preview.canTake}
            onClick={onConfirm}
            className="touch-target inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:h-10"
          >
            {starting ? <Spinner className="size-4" /> : null}
            I&apos;m ready — start exam
          </button>
        </div>
      </div>
    </div>
  )
}
