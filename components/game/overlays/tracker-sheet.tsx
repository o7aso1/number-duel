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
      <p className="mb-4 text-center text-sm leading-relaxed text-muted-foreground text-pretty">
        اضغط على أي رقم لاستبعاده من رقم الخصم. الرقم المستبعد يظهر بعلامة حمراء.
      </p>
      <div className="grid grid-cols-5 gap-3" dir="ltr">
        {DIGITS.map((d) => {
          const isMarked = marked.has(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onToggle(d)}
              aria-pressed={isMarked}
              aria-label={isMarked ? `إلغاء استبعاد ${d}` : `استبعاد ${d}`}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-2xl border-2',
                'font-mono text-2xl font-bold tabular transition-all active:scale-95',
                isMarked
                  ? 'border-destructive/60 bg-destructive/15 text-muted-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/50',
              )}
            >
              <span className={cn(isMarked && 'opacity-40')}>{d}</span>
              {isMarked && (
                <X
                  aria-hidden
                  className="pointer-events-none absolute inset-0 m-auto size-8 text-destructive"
                  strokeWidth={3}
                />
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {marked.size > 0
          ? `مستبعد: ${marked.size} أرقام`
          : 'ما في أرقام مستبعدة بعد'}
      </p>
    </Sheet>
  )
}
