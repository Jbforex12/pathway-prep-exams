'use client'

import { useEffect, useState } from 'react'
import { PathwayLogo } from '@/components/logo'
import { Spinner } from '@/components/ui-bits'

const WAKE_TIMEOUT_MS = 120_000
const RETRY_MS = 3_000

async function pingHealth() {
  const res = await fetch('/health', { cache: 'no-store' })
  if (!res.ok) throw new Error('unhealthy')
  return res.json()
}

export function ServiceWake({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    let cancelled = false
    const started = Date.now()

    const tick = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000))
    }, 1000)

    async function waitForService() {
      while (!cancelled && Date.now() - started < WAKE_TIMEOUT_MS) {
        try {
          await pingHealth()
          if (!cancelled) setReady(true)
          return
        } catch {
          await new Promise((r) => setTimeout(r, RETRY_MS))
        }
      }
      if (!cancelled) setReady(true)
    }

    void waitForService()

    return () => {
      cancelled = true
      window.clearInterval(tick)
    }
  }, [])

  if (ready) return <>{children}</>

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/30 px-6 text-center">
      <PathwayLogo subtitle="Exams" />
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner className="size-5" />
        <p className="text-sm sm:text-base">Starting exam portal… usually under a minute on first visit.</p>
      </div>
      {seconds > 10 ? (
        <p className="max-w-sm text-xs text-muted-foreground">
          Still waking up ({seconds}s). This page will load automatically — please don&apos;t refresh.
        </p>
      ) : null}
    </main>
  )
}
