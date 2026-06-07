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
  children,
}: {
  title: string
  subtitle?: string
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
        <div className="safe-px mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4">
          <Link href="/admin/dashboard/">
            <PathwayLogo subtitle="Exam Admin" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
        <nav className="safe-px mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto border-t border-border/60">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href.replace(/\/$/, ''))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium',
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
      <main className="safe-px safe-pb mx-auto w-full max-w-7xl py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Pathway Prep Exams</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  )
}
