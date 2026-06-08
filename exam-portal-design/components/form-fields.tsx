'use client'

import { cn } from '@/lib/utils'

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-foreground/80 uppercase">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-12 w-full min-h-12 rounded-lg border border-border bg-background px-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-11 sm:min-h-11 sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-12 w-full min-h-12 rounded-lg border border-border bg-background px-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-11 sm:min-h-11 sm:text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
