'use client'

import { AlertCircle, CheckCircle2, Send } from 'lucide-react'
import { Spinner } from '@/components/ui-bits'

type Question = { id: string; prompt: string }

type Props = {
  examTitle: string
  questions: Question[]
  answers: Record<string, number>
  unanswered: number
  submitting: boolean
  onBack: () => void
  onJump: (index: number) => void
  onSubmit: () => void
}

export function ReviewScreen({ examTitle, questions, answers, unanswered, submitting, onBack, onJump, onSubmit }: Props) {
  return (
    <main className="safe-px safe-pb mx-auto max-w-3xl py-4 sm:py-8">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-heading text-xl font-bold">Review before submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">{examTitle}</p>

        {unanswered > 0 ? (
          <div className="mt-4 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              You have <strong>{unanswered}</strong> unanswered question{unanswered === 1 ? '' : 's'}. You can still
              submit, or go back to complete them.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <p>All questions answered. Review the list below, then submit when ready.</p>
          </div>
        )}

        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {questions.map((q, i) => {
            const answered = answers[q.id] !== undefined
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40"
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      answered ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-foreground">{q.prompt}</span>
                    <span className={`mt-1 block text-xs ${answered ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {answered ? 'Answered' : 'Not answered'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          disabled={submitting}
          onClick={onBack}
          className="touch-target h-12 rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-60 sm:h-10"
        >
          Back to exam
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="touch-target inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:h-10"
        >
          {submitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
          Submit final answers
        </button>
      </div>
    </main>
  )
}
