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
    <Sheet open={open} onClose={onClose} title="علّم الأرقام" placement="center">
      <p className="mb-3 text-sm text-muted-foreground text-pretty">
        اضغط خانة لحط ✕ أحمر — كل صف رقم، وكل عمود موضع في رقم الخصم.
      </p>

      {/* Column headers: positions */}
      <div
        className="mb-1.5 grid gap-1.5"
        style={{ gridTemplateColumns: `1.6rem repeat(${slots}, minmax(0, 1fr))` }}
        dir="ltr"
      >
        <span />
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className="text-center font-mono text-[11px] font-semibold tabular text-muted-foreground"
          >
            {i + 1}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5" dir="ltr">
        {DIGITS.map((digit) => (
          <div
            key={digit}
            className="grid items-center gap-1.5"
            style={{ gridTemplateColumns: `1.6rem repeat(${slots}, minmax(0, 1fr))` }}
          >
            <span className="text-center font-mono text-sm font-bold tabular text-muted-foreground">
              {digit}
            </span>
            {Array.from({ length: slots }, (_, slot) => {
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
                    'relative grid min-h-11 place-items-center rounded-xl border font-mono text-lg font-bold tabular transition-all active:scale-95',
                    isCrossed
                      ? 'border-destructive/50 bg-destructive/10 text-muted-foreground/50'
                      : 'border-border bg-card text-foreground hover:border-primary/45',
                  )}
                >
                  <span>{digit}</span>
                  {isCrossed && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 grid place-items-center text-xl font-extrabold text-destructive"
                    >
                      ✕
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
