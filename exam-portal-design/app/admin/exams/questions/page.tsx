'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Field, Select, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import {
  ApiError,
  adminAddQuestion,
  adminDeleteQuestion,
  adminGetExam,
  adminImportConfirm,
  adminImportPreview,
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

function QuestionsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get('id') || ''
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<ExamAdminRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [prompt, setPrompt] = useState('')
  const [opts, setOpts] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [importPreview, setImportPreview] = useState<QuestionRow[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  async function load() {
    const data = await adminGetExam(examId)
    setExam(data.exam)
    setQuestions(data.questions)
  }

  useEffect(() => {
    if (!examId) return
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [examId, router])

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault()
    const options = opts.map((o) => o.trim()).filter(Boolean)
    await adminAddQuestion(examId, { prompt, options, correct_index: correct, sort_order: questions.length + 1 })
    setPrompt('')
    setOpts(['', '', '', ''])
    await load()
  }

  async function onFile(file: File, type: 'excel' | 'pdf') {
    const b64 = await fileToBase64(file)
    const res = await adminImportPreview(examId, type, b64)
    setImportPreview(res.questions)
    setImportErrors(res.errors || [])
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

  return (
    <AdminShell title={exam.title} subtitle={`${exam.course_name} · ${exam.status} · ${questions.length} questions`}>
      <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cutoff %">
          <TextInput
            type="number"
            defaultValue={exam.cutoff_percent}
            onBlur={(e) => adminUpdateExam(examId, { cutoff_percent: parseInt(e.target.value, 10) }).then(load)}
          />
        </Field>
        <Field label="Duration (min)">
          <TextInput
            type="number"
            defaultValue={exam.duration_minutes}
            onBlur={(e) => adminUpdateExam(examId, { duration_minutes: parseInt(e.target.value, 10) }).then(load)}
          />
        </Field>
        <Field label="Questions per attempt">
          <TextInput
            type="number"
            defaultValue={exam.question_count}
            onBlur={(e) => adminUpdateExam(examId, { question_count: parseInt(e.target.value, 10) }).then(load)}
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

      <div className="mb-6 flex flex-wrap gap-3">
        <a href="/assets/question-import-template.xlsx" className="rounded-lg border border-border px-3 py-2 text-sm">
          Download Excel template
        </a>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <Upload className="size-4" />
          Import Excel
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0], 'excel')} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <Upload className="size-4" />
          Import PDF
          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0], 'pdf')} />
        </label>
        {exam.status !== 'published' ? (
          <button type="button" onClick={() => adminPublishExam(examId).then(load)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Publish exam
          </button>
        ) : null}
      </div>

      {importPreview ? (
        <div className="mb-6 rounded-xl border border-primary/30 bg-card p-5">
          <h3 className="font-semibold">Import preview ({importPreview.length} questions)</h3>
          {importErrors.map((e) => (
            <p key={e} className="mt-1 text-sm text-destructive">
              {e}
            </p>
          ))}
          <button type="button" onClick={() => adminImportConfirm(examId, importPreview, true).then(() => { setImportPreview(null); load() })} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Confirm import
          </button>
        </div>
      ) : null}

      <form onSubmit={addQuestion} className="mb-8 rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Add question manually</h3>
        <Field label="Question">
          <TextInput value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
        </Field>
        {opts.map((o, i) => (
          <Field key={i} label={`Option ${String.fromCharCode(65 + i)}`}>
            <TextInput value={o} onChange={(e) => setOpts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
          </Field>
        ))}
        <Field label="Correct option">
          <Select value={String(correct)} onChange={(e) => setCorrect(parseInt(e.target.value, 10))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {String.fromCharCode(65 + i)}
              </option>
            ))}
          </Select>
        </Field>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Add question
        </button>
      </form>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id || i} className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{q.prompt}</p>
            {q.id ? (
              <button type="button" onClick={() => adminDeleteQuestion(q.id!).then(load)} className="mt-2 text-xs text-destructive">
                Delete
              </button>
            ) : null}
          </div>
        ))}
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
