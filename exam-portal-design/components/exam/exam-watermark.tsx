'use client'

import { useMemo } from 'react'

type Props = {
  studentName: string
}

export function ExamWatermark({ studentName }: Props) {
  const label = useMemo(() => {
    const name = studentName.trim() || 'Candidate'
    const stamp = new Date().toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${name} · Pathway Prep · ${stamp}`
  }, [studentName])

  const tiles = useMemo(() => Array.from({ length: 18 }, (_, i) => i), [])

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden select-none"
      aria-hidden
      style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {tiles.map((i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        return (
          <span
            key={i}
            className="absolute whitespace-nowrap text-[11px] font-medium tracking-wide text-foreground/[0.07] sm:text-xs"
            style={{
              top: `${8 + row * 28}%`,
              left: `${-5 + col * 38}%`,
              transform: 'rotate(-22deg)',
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
