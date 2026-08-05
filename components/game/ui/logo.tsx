import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-primary-foreground',
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
    <span className="grid size-9 place-items-center rounded-lg bg-primary text-lg font-bold tabular shadow-sm">
      {children}
    </span>
  )
}
