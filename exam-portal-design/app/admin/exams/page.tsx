'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AdminShell } from '@/components/admin-shell'
import { Field, Select, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import { COURSES } from '@/lib/exam-data'
import { ApiError, adminCreateExam, adminExams, type ExamAdminRow } from '@/lib/exam-api'

export default function AdminExamsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<ExamAdminRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState(COURSES[0])
  const [saving, setSaving] = useState(false)

  function refresh() {
    return adminExams().then((r) => setExams(r.exams))
  }

  useEffect(() => {
    refresh()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/admin/')
      })
      .finally(() => setLoading(false))
  }, [router])

  async function createExam(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminCreateExam({ title, course_name: course })
      setTitle('')
      setShowForm(false)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell title="Exams" subtitle="Create exams per course, add questions, then publish.">
      <div className="mb-4 flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="touch-target inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground sm:h-9 sm:w-auto"
        >
          <Plus className="size-4" />
          New exam
        </button>
      </div>

      {showForm ? (
        <form onSubmit={createExam} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <Field label="Title" htmlFor="title">
            <TextInput id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Course" htmlFor="course">
            <Select id="course" value={course} onChange={(e) => setCourse(e.target.value)}>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="touch-target h-12 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:h-auto sm:w-auto"
          >
            {saving ? 'Saving…' : 'Create draft'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {exams.map((exam) => (
              <div key={exam.id} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium break-words">{exam.title}</p>
                <p className="mt-1 text-xs text-muted-foreground break-words">{exam.course_name}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-1 capitalize">{exam.status}</span>
                  <span className="rounded-full bg-muted px-2 py-1">{exam.question_pool ?? 0} questions</span>
                </div>
                <Link
                  href={`/admin/exams/questions/?id=${encodeURIComponent(exam.id)}`}
                  className="touch-target mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-primary"
                >
                  Manage questions
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <div className="mobile-scroll-x md:overflow-visible md:p-0">
              <table className="min-w-[640px] w-full text-left text-sm md:min-w-0">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{exam.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{exam.course_name}</td>
                      <td className="px-4 py-3 capitalize">{exam.status}</td>
                      <td className="px-4 py-3">{exam.question_pool ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/exams/questions/?id=${encodeURIComponent(exam.id)}`}
                          className="font-medium text-primary"
                        >
                          Questions →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  )
}
