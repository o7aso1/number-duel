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
  onClear,
}: {
  open: boolean
  onClose: () => void
  length: number
  crossed: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
}) {
  const slots = Math.max(3, Math.min(6, length || 4))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ملاحظاتي"
      placement="center"
      compact
      className="max-w-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">اضغط رقمًا لاستبعاده من خانة، أو استبعد الصف كاملًا.</p>
        <button type="button" onClick={onClear} className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">مسح</button>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-1.5" dir="ltr">
        {DIGITS.map((digit) => {
          const allCrossed = Array.from({ length: slots }, (_, slot) => crossed.has(cellKey(digit, slot))).every(Boolean)
          return (
            <button
              key={`all-${digit}`}
              type="button"
              onClick={() => {
                for (let slot = 0; slot < slots; slot++) {
                  const key = cellKey(digit, slot)
                  if (crossed.has(key) === allCrossed) onToggle(key)
                }
              }}
              className={cn(
                'grid size-8 place-items-center rounded-lg border font-mono text-xs font-bold',
                allCrossed ? 'border-destructive/50 bg-destructive/10 text-destructive line-through' : 'border-border bg-card',
              )}
              aria-label={`استبعاد الرقم ${digit} من كل الخانات`}
            >{digit}</button>
          )
        })}
      </div>

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
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(key)
                }}
                aria-pressed={isCrossed}
                aria-label={
                  isCrossed
                    ? `إلغاء استبعاد الرقم ${digit} من الموضع ${slot + 1}`
                    : `استبعاد الرقم ${digit} من الموضع ${slot + 1}`
                }
                className={cn(
                  // Fixed height (not aspect-square) — readable size, still fits without scroll
                  'relative grid h-9 w-full place-items-center rounded-xl border font-mono text-sm font-bold tabular leading-none transition-all active:scale-95',
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
