'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { PathwayLogo } from '@/components/logo'
import { Field, TextInput } from '@/components/form-fields'
import { Spinner } from '@/components/ui-bits'
import { ApiError, adminLogin } from '@/lib/exam-api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await adminLogin(key)
      router.replace('/admin/dashboard/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="safe-px flex min-h-dvh items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <PathwayLogo subtitle="Exam Admin" />
        <h1 className="mt-6 font-heading text-2xl font-semibold">Admin sign in</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Admin API key" htmlFor="key" error={error}>
            <TextInput id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} required />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? <Spinner /> : <KeyRound className="size-4" />}
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
