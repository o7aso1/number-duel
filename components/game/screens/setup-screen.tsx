'use client'

import { useCallback, useState } from 'react'
import { ArrowRight, Lock, Check } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { useDigitKeyboard } from '@/lib/use-digit-keyboard'
import { cn } from '@/lib/utils'

export function SetupScreen({
  length,
  onConfirm,
  onBack,
  waitingOpponent,
  error,
  busy,
}: {
  length: number
  onConfirm: (secret: string) => void | Promise<void>
  onBack: () => void
  waitingOpponent?: boolean
  error?: string | null
  busy?: boolean
}) {
  const [value, setValue] = useState('')
  const digitCount = length >= 3 && length <= 5 ? length : 4
  const slots = Array.from({ length: digitCount }, (_, i) => value[i] ?? '')
  const full = value.length === digitCount
  const valid = full

  const addDigit = (d: string) => {
    if (waitingOpponent || busy || value.length >= digitCount) return
    setValue((v) => v + d)
  }
  const del = () => {
    if (waitingOpponent || busy) return
    setValue((v) => v.slice(0, -1))
  }

  const submit = useCallback(() => {
    if (!valid || busy || waitingOpponent) return
    void onConfirm(value)
  }, [valid, busy, waitingOpponent, onConfirm, value])

  useDigitKeyboard({
    enabled: !waitingOpponent && !busy,
    maxLength: digitCount,
    value,
    onChange: setValue,
    onSubmit: submit,
  })

  if (waitingOpponent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-8">
        <div className="grid size-16 place-items-center rounded-2xl border border-primary/40 bg-primary/15 text-primary">
          <Lock className="size-7 animate-pulse" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">الخصم يختار رقمه…</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            الكمبيوتر يفكر ويختار رقمه السري — ثوانٍ قليلة.
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2.5 rounded-full bg-primary/70 animate-pulse"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-6 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center">
          <button
            type="button"
            onClick={onBack}
            aria-label="خروج من المواجهة"
            className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-5" />
          </button>
          <h1 className="mr-3 text-xl font-bold">اختر رقمك السري</h1>
        </header>

        <div>
          <p className="mb-3 text-center text-sm text-muted-foreground">رقمك</p>
          <div className="flex justify-center gap-2.5" dir="ltr">
            {slots.map((d, i) => (
              <div
                key={i}
                className={cn(
                  'grid size-12 place-items-center rounded-2xl border-2 font-mono text-2xl font-bold tabular transition-colors',
                  d
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-dashed border-border bg-card text-muted-foreground',
                  i === value.length && !full && 'border-primary/70 animate-pulse',
                )}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground text-pretty">
          تقدر تكرر نفس الرقم في سرك. التخمين لاحقًا ممنوع فيه التكرار الكامل.
        </p>

        {error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/15 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Keypad onDigit={addDigit} onDelete={del} disabled={busy} />

        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? (
            'جارٍ التثبيت…'
          ) : (
            <>
              {valid ? <Check className="size-5" /> : <Lock className="size-5" />}
              تثبيت الرقم
            </>
          )}
        </button>
      </div>
    </div>
  )
}
