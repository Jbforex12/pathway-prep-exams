'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileQuestion, ClipboardList, LogOut } from 'lucide-react'
import { PathwayLogo } from '@/components/logo'
import { adminLogout } from '@/lib/exam-api'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/dashboard/', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/exams/', label: 'Exams', icon: FileQuestion },
  { href: '/admin/attempts/', label: 'Attempts', icon: ClipboardList },
] as const

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await adminLogout()
    router.push('/admin/')
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="safe-pt sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="safe-px mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 sm:h-16 sm:gap-4">
          <Link href="/admin/dashboard/" className="min-w-0 shrink">
            <PathwayLogo subtitle="Exam Admin" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="touch-target inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium sm:px-3"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        <nav className="safe-px mx-auto flex w-full max-w-7xl gap-0 overflow-x-auto border-t border-border/60 sm:gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href.replace(/\/$/, ''))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'touch-target inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium sm:px-4',
                  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="safe-px safe-pb mx-auto w-full max-w-7xl py-4 sm:py-8">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Pathway Prep Exams</p>
            <h1 className="mt-1 font-heading text-xl font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-xs leading-relaxed break-words text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  )
}
