'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, Plus, Trash2, Upload } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Field, Select, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import {
  QUESTION_TYPES,
  defaultOptionsForType,
  questionTypeLabel,
  type QuestionType,
} from '@/lib/exam-data'
import {
  ApiError,
  adminAddQuestion,
  adminDeleteQuestion,
  adminGetExam,
  adminImportExcel,
  adminPublishExam,
  adminUpdateExam,
  type ExamAdminRow,
  type QuestionRow,
} from '@/lib/exam-api'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function clampTimerMinutes(value: number) {
  if (!Number.isFinite(value)) return 30
  return Math.min(180, Math.max(5, value))
}

function QuestionsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get('id') || ''
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamAdminRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [prompt, setPrompt] = useState('')
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice')
  const [opts, setOpts] = useState(['', ''])
  const [correct, setCorrect] = useState(0)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [savingTimer, setSavingTimer] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [statusErr, setStatusErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    const data = await adminGetExam(examId)
    setExam(data.exam)
    setQuestions(data.questions)
    setTimerMinutes(clampTimerMinutes(data.exam.duration_minutes))
  }

  useEffect(() => {
    if (!examId) return
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [examId, router])

  function onTypeChange(type: QuestionType) {
    setQuestionType(type)
    setOpts(defaultOptionsForType(type))
    setCorrect(0)
  }

  function showSuccess(msg: string) {
    setStatusErr('')
    setStatusMsg(msg)
  }

  function showError(msg: string) {
    setStatusMsg('')
    setStatusErr(msg)
  }

  async function saveTimer() {
    setSavingTimer(true)
    setStatusErr('')
    try {
      const minutes = clampTimerMinutes(timerMinutes)
      setTimerMinutes(minutes)
      await adminUpdateExam(examId, { duration_minutes: minutes })
      await load()
      showSuccess(`Exam timer set to ${minutes} minutes. Students see a countdown from this value.`)
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not save timer.')
    } finally {
      setSavingTimer(false)
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault()
    setStatusErr('')
    try {
      const options = opts.map((o) => o.trim()).filter(Boolean)
      await adminAddQuestion(examId, {
        prompt,
        question_type: questionType,
        options,
        correct_index: correct,
        sort_order: questions.length + 1,
      })
      setPrompt('')
      onTypeChange('multiple_choice')
      await load()
      showSuccess('Question added.')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not add question.')
    }
  }

  async function onExcelUpload(file: File) {
    setImporting(true)
    setStatusErr('')
    try {
      const b64 = await fileToBase64(file)
      const res = await adminImportExcel(examId, b64)
      await load()
      const warn = res.errors?.length ? ` (${res.errors.length} row warning(s) skipped)` : ''
      showSuccess(res.message || `Imported ${res.imported} questions.${warn}`)
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Excel import failed.')
    } finally {
      setImporting(false)
    }
  }

  async function publish() {
    setPublishing(true)
    setStatusErr('')
    try {
      const res = await adminPublishExam(examId)
      await load()
      showSuccess(res.message || 'Exam published.')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not publish exam.')
    } finally {
      setPublishing(false)
    }
  }

  async function deleteQuestion(q: QuestionRow) {
    if (!q.id) return
    const label = q.prompt.length > 80 ? `${q.prompt.slice(0, 80)}…` : q.prompt
    if (
      !window.confirm(
        `Delete this question?\n\n"${label}"\n\nThis cannot be undone. Republish the exam if it is already live.`,
      )
    ) {
      return
    }
    setDeletingId(q.id)
    setStatusErr('')
    try {
      await adminDeleteQuestion(q.id)
      await load()
      showSuccess('Question deleted.')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Could not delete question.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading || !exam) {
    return (
      <AdminShell title="Questions">
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </AdminShell>
    )
  }

  const pool = questions.length
  const perAttempt = Math.min(exam.question_count, pool)

  return (
    <AdminShell
      title={exam.title}
      subtitle={`${exam.course_name} · ${exam.status} · ${pool} in pool · ${perAttempt} per attempt · ${exam.duration_minutes} min timer · ${exam.attempts_max ?? 2} attempts max`}
    >
      {statusMsg ? (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {statusMsg}
        </div>
      ) : null}
      {statusErr ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {statusErr}
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          <h3 className="font-semibold">Exam timer</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Students see a live countdown when they start. At 0:00 the exam auto-submits and shows their results.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Field label="Duration (minutes)">
              <TextInput
                type="number"
                min={5}
                max={180}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(parseInt(e.target.value, 10) || 30)}
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={savingTimer}
            onClick={() => void saveTimer()}
            className="touch-target h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:h-10 sm:w-auto"
          >
            {savingTimer ? 'Saving…' : 'Save timer'}
          </button>
          <span className="text-xs text-muted-foreground sm:pb-2">5–180 minutes · default 30</span>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Cutoff %">
          <TextInput
            type="number"
            defaultValue={exam.cutoff_percent}
            onBlur={(e) => adminUpdateExam(examId, { cutoff_percent: parseInt(e.target.value, 10) }).then(load)}
          />
        </Field>
        <Field label="Questions per attempt">
          <TextInput
            type="number"
            defaultValue={exam.question_count}
            onBlur={(e) => adminUpdateExam(examId, { question_count: parseInt(e.target.value, 10) }).then(load)}
          />
        </Field>
        <Field label="Max attempts per student">
          <TextInput
            type="number"
            min={1}
            max={10}
            defaultValue={exam.attempts_max ?? 2}
            onBlur={(e) =>
              adminUpdateExam(examId, {
                attempts_max: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 2)),
              }).then(load)
            }
          />
        </Field>
        <Field label="Shuffle mode">
          <Select
            defaultValue={exam.shuffle_mode}
            onChange={(e) => adminUpdateExam(examId, { shuffle_mode: e.target.value }).then(load)}
          >
            <option value="questions">Random questions + shuffle options</option>
            <option value="options_only">Same questions, shuffle options only</option>
          </Select>
        </Field>
      </div>

      <div className="mb-6 rounded-xl border border-primary/20 bg-card p-5">
        <h3 className="font-semibold">Upload questions from Excel</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an Excel file with columns: <strong>Type</strong> (optional), <strong>Question</strong>,{' '}
          <strong>Option1</strong>–<strong>Option6</strong> (or OptionA–D), and <strong>Answer</strong> (A/B/C, 1/2/3, or
          exact option text). Questions are imported immediately.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="/assets/question-import-template.xlsx"
            className="touch-target inline-flex h-12 items-center justify-center rounded-lg border border-border px-3 text-sm sm:h-auto"
          >
            Download template
          </a>
          <label className="touch-target inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:h-auto">
            {importing ? <Spinner className="size-4" /> : <Upload className="size-4" />}
            {importing ? 'Importing…' : 'Upload Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onExcelUpload(f)
                e.target.value = ''
              }}
            />
          </label>
          {exam.status === 'published' ? (
            <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Published
            </span>
          ) : null}
          <button
            type="button"
            disabled={publishing || pool < 1}
            onClick={() => void publish()}
            className="touch-target h-12 w-full rounded-lg border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary disabled:opacity-40 sm:h-auto sm:w-auto"
          >
            {publishing
              ? exam.status === 'published'
                ? 'Republishing…'
                : 'Publishing…'
              : exam.status === 'published'
                ? 'Republish changes'
                : 'Publish exam'}
          </button>
        </div>
        {pool < 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">Add or import at least one question to enable publishing.</p>
        ) : exam.status === 'published' ? (
          <p className="mt-3 text-xs text-muted-foreground">
            After editing questions, timer, or settings, click <strong>Republish changes</strong>. Students will see the
            updated exam on their dashboard and any in-progress attempts are cleared so they start fresh with the new
            version.
          </p>
        ) : null}
      </div>

      <form onSubmit={addQuestion} className="mb-8 rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Add question manually</h3>
        <Field label="Question type">
          <Select value={questionType} onChange={(e) => onTypeChange(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Question">
          <TextInput value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        </Field>
        {opts.map((o, i) => (
          <Field key={i} label={`Option ${i + 1}`}>
            <TextInput
              value={o}
              disabled={questionType !== 'multiple_choice'}
              onChange={(e) => setOpts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </Field>
        ))}
        {questionType === 'multiple_choice' ? (
          <button
            type="button"
            onClick={() => setOpts((prev) => (prev.length < 8 ? [...prev, ''] : prev))}
            className="inline-flex items-center gap-1 text-sm text-primary"
          >
            <Plus className="size-4" />
            Add option
          </button>
        ) : null}
        <Field label="Correct answer">
          <Select value={String(correct)} onChange={(e) => setCorrect(parseInt(e.target.value, 10))}>
            {opts.map((opt, i) => (
              <option key={i} value={i}>
                {opt.trim() || `Option ${i + 1}`}
              </option>
            ))}
          </Select>
        </Field>
        <button
          type="submit"
          className="touch-target h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:h-auto sm:w-auto"
        >
          Add question
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold">Question bank ({pool})</h3>
        {questions.map((q, i) => (
          <div key={q.id || i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-primary uppercase">
                  {questionTypeLabel(q.question_type)} · Q{q.sort_order || i + 1}
                </p>
                <p className="mt-1 font-medium">{q.prompt}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={oi === q.correct_index ? 'font-semibold text-foreground' : ''}>
                      {oi === q.correct_index ? '✓ ' : '· '}
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
              {q.id ? (
                <button
                  type="button"
                  disabled={deletingId === q.id}
                  onClick={() => void deleteQuestion(q)}
                  className="touch-target inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  aria-label="Delete question"
                  title="Delete question"
                >
                  {deletingId === q.id ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
                  <span className="hidden sm:inline">Delete</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!questions.length ? (
          <p className="text-sm text-muted-foreground">No questions yet — upload Excel or add manually above.</p>
        ) : null}
      </div>
    </AdminShell>
  )
}

export default function ExamQuestionsPage() {
  return (
    <Suspense>
      <QuestionsInner />
    </Suspense>
  )
}
