'use client'

import { X } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import { cn } from '@/lib/utils'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export function TrackerSheet({
  open,
  onClose,
  marked,
  onToggle,
}: {
  open: boolean
  onClose: () => void
  marked: Set<string>
  onToggle: (digit: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="لوحة الاستبعاد">
      <p className="mb-4 text-sm text-muted-foreground text-pretty">
        علّم الأرقام التي استبعدتها من رقم الخصم بعلامة حمراء.
      </p>
      <div className="grid grid-cols-5 gap-2.5" dir="ltr">
        {DIGITS.map((d) => {
          const isMarked = marked.has(d)
          return (
            <button
              key={d}
              onClick={() => onToggle(d)}
              aria-pressed={isMarked}
              className={cn(
                'relative grid aspect-square place-items-center rounded-2xl border-2 font-mono text-2xl font-bold tabular transition-all active:scale-95',
                isMarked
                  ? 'border-destructive/50 bg-destructive/10 text-muted-foreground'
                  : 'border-border bg-card text-foreground',
              )}
            >
              {d}
              {isMarked && (
                <X
                  className="absolute size-10 text-destructive animate-in zoom-in-50 duration-150"
                  strokeWidth={3}
                />
              )}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
