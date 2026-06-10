'use client'

import { useEffect } from 'react'

/** Pings the API in the background so Render stays warm — does not block the UI. */
export function ServiceWarmup() {
  useEffect(() => {
    fetch('/health', { cache: 'no-store' }).catch(() => {})
  }, [])
  return null
}
