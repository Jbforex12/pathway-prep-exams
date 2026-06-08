'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { PathwayLogo } from '@/components/logo'
import { Field, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import { ApiError, requestOtp } from '@/lib/exam-api'

export default function StudentLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await requestOtp(email.trim().toLowerCase())
      setSent(true)
      sessionStorage.setItem('pp_exam_email', email.trim().toLowerCase())
      router.push('/verify/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="safe-px safe-pb flex min-h-dvh items-center justify-center bg-background py-6">
      <div className="page-card w-full shadow-sm">
        <PathwayLogo subtitle="Exams" />
        <h1 className="mt-6 font-heading text-2xl font-semibold">Student sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email your training partner registered. We will send a one-time code.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email" error={error}>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="touch-target inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Spinner /> : <ArrowRight className="size-4" />}
            {sent ? 'Code sent — continue' : 'Send sign-in code'}
          </button>
        </form>
      </div>
    </main>
  )
}
