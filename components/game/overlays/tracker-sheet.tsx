'use client'

import { Sheet } from '@/components/game/ui/sheet'
import { cn } from '@/lib/utils'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export function cellKey(digit: number, slot: number) {
  return `${digit}-${slot}`
}

export function TrackerSheet({
  open,
  onClose,
  length,
  crossed,
  onToggle,
}: {
  open: boolean
  onClose: () => void
  length: number
  crossed: Set<string>
  onToggle: (key: string) => void
}) {
  const slots = Math.max(3, Math.min(5, length || 4))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="علّم الأرقام"
      placement="center"
      compact
      className="max-w-sm"
    >
      <p className="mb-2.5 text-center text-xs text-muted-foreground">اضغط خانة لوضع ✕</p>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
        dir="ltr"
      >
        {DIGITS.flatMap((digit) =>
          Array.from({ length: slots }, (_, slot) => {
            const key = cellKey(digit, slot)
            const isCrossed = crossed.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggle(key)}
                aria-pressed={isCrossed}
                aria-label={
                  isCrossed
                    ? `إلغاء استبعاد الرقم ${digit} من الموضع ${slot + 1}`
                    : `استبعاد الرقم ${digit} من الموضع ${slot + 1}`
                }
                className={cn(
                  // Fixed height (not aspect-square) — readable size, still fits without scroll
                  'relative grid h-10 w-full place-items-center rounded-xl border font-mono text-base font-bold tabular leading-none transition-all active:scale-95',
                  isCrossed
                    ? 'border-destructive/50 bg-destructive/10 text-muted-foreground/50'
                    : 'border-border bg-card text-foreground hover:border-primary/45',
                )}
              >
                <span>{digit}</span>
                {isCrossed && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-extrabold text-destructive"
                  >
                    ✕
                  </span>
                )}
              </button>
            )
          }),
        )}
      </div>
    </Sheet>
  )
}
