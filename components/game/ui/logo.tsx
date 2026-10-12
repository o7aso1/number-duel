import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div
      dir="ltr"
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-primary-foreground drop-shadow-[0_8px_20px_color-mix(in_oklab,var(--primary)_28%,transparent)]',
        className,
      )}
      aria-hidden="true"
    >
      <Tile>7</Tile>
      <Tile>4</Tile>
      <Tile>2</Tile>
    </div>
  )
}

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-9 place-items-center rounded-[11px] border border-white/20 bg-gradient-to-br from-primary via-primary to-secondary/80 text-lg font-black tabular shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_8px_22px_color-mix(in_oklab,var(--primary)_28%,transparent)]">
      {children}
    </span>
  )
}
