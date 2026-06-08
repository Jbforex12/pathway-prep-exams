'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PathwayLogo } from '@/components/logo'
import { Field, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import { ApiError, verifyOtp } from '@/lib/exam-api'

export default function VerifyPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('pp_exam_email') || ''
    setEmail(stored)
    if (!stored) router.replace('/')
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await verifyOtp(email, code.trim())
      router.replace('/dashboard/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="safe-px safe-pb flex min-h-dvh items-center justify-center py-6">
      <div className="page-card w-full shadow-sm">
        <PathwayLogo subtitle="Exams" />
        <h1 className="mt-6 font-heading text-2xl font-semibold">Enter your code</h1>
        <p className="mt-2 text-sm text-muted-foreground">We sent a 6-digit code to {email || 'your email'}.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Sign-in code" htmlFor="code" error={error}>
            <TextInput
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="touch-target inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? <Spinner /> : null}
            Continue to exams
          </button>
        </form>
      </div>
    </main>
  )
}
