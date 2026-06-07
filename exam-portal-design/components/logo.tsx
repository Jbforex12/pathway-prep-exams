import { cn } from '@/lib/utils'

export function PathwayLogo({ subtitle = 'Exams' }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" className="size-8 rounded-md object-cover" />
      <div className="flex flex-col leading-none">
        <span className="font-heading text-base font-semibold tracking-tight text-foreground">Pathway Prep</span>
        <span className="mt-0.5 text-[0.65rem] font-medium tracking-[0.18em] text-primary uppercase">{subtitle}</span>
      </div>
    </div>
  )
}
