'use client'

import { LayoutGrid, X } from 'lucide-react'

type Props = {
  total: number
  currentIndex: number
  answers: Record<string, number>
  questionIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onJump: (index: number) => void
}

export function QuestionPaletteButton({ currentIndex, total, onClick }: { currentIndex: number; total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary sm:h-9"
      aria-label="Open question navigator"
    >
      <LayoutGrid className="size-4" />
      <span>Q {currentIndex + 1}</span>
      <span className="text-xs font-normal text-muted-foreground">/ {total}</span>
    </button>
  )
}

export function QuestionPalette({ total, currentIndex, answers, questionIds, open, onOpenChange, onJump }: Props) {
  if (!open) return null

  const answeredCount = questionIds.filter((id) => answers[id] !== undefined).length

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Question navigator</p>
            <p className="text-xs text-muted-foreground">
              {answeredCount} of {total} answered — tap a number to jump
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="touch-target inline-flex size-10 items-center justify-center rounded-lg border border-border"
            aria-label="Close navigator"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {Array.from({ length: total }, (_, i) => {
              const qid = questionIds[i]
              const answered = qid ? answers[qid] !== undefined : false
              const isCurrent = i === currentIndex
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onJump(i)
                    onOpenChange(false)
                  }}
                  className={`touch-target flex aspect-square min-h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                    isCurrent
                      ? 'border-primary bg-primary text-primary-foreground'
                      : answered
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border border-primary bg-primary" /> Current
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border border-emerald-500/50 bg-emerald-500/10" /> Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border border-border bg-muted/30" /> Unanswered
          </span>
        </div>
      </div>
    </div>
  )
}
