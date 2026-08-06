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
        'inline-flex h-12 w-full items-center justify-center rounded-xl',
        'font-mono text-xl font-semibold tabular',
        'border border-border transition-all active:scale-95 active:brightness-110',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'default'
          ? 'bg-card text-card-foreground hover:border-primary/60'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
