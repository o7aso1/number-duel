'use client'

import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

type KeypadProps = {
  onDigit: (digit: string) => void
  onDelete: () => void
  disabled?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete, disabled }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-2" dir="ltr">
      {KEYS.map((k) => (
        <KeyButton key={k} onClick={() => onDigit(k)} disabled={disabled}>
          {k}
        </KeyButton>
      ))}
      <KeyButton onClick={onDelete} disabled={disabled} variant="muted" ariaLabel="حذف">
        <Delete className="size-5 shrink-0" strokeWidth={2.25} />
      </KeyButton>
      <KeyButton onClick={() => onDigit('0')} disabled={disabled}>
        0
      </KeyButton>
      <span aria-hidden className="invisible" />
    </div>
  )
}

function KeyButton({
  children,
  onClick,
  disabled,
  variant = 'default',
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'muted'
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-13 w-full items-center justify-center rounded-[15px]',
        'font-mono text-xl font-black tabular',
        'border transition-all duration-150 active:scale-[0.94] active:translate-y-0.5',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'default'
          ? 'border-white/10 bg-gradient-to-b from-white/[.075] to-white/[.025] text-card-foreground shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_5px_14px_rgb(0_0_0/.16)] hover:border-primary/50 hover:bg-primary/10'
          : 'border-white/8 bg-white/[.035] text-muted-foreground hover:border-destructive/40 hover:text-destructive',
      )}
    >
      {children}
    </button>
  )
}
