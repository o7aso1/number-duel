'use client'

import { useState } from 'react'
import { ArrowRight, Lock, Check } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { cn } from '@/lib/utils'

export function SetupScreen({
  length,
  onConfirm,
  onBack,
  waitingOpponent,
}: {
  length: number
  onConfirm: (secret: string) => void
  onBack: () => void
  waitingOpponent?: boolean
}) {
  const [value, setValue] = useState('')
  const slots = Array.from({ length }, (_, i) => value[i] ?? '')
  const full = value.length === length
  const valid = full

  const addDigit = (d: string) => {
    if (waitingOpponent || value.length >= length) return
    setValue((v) => v + d)
  }
  const del = () => {
    if (waitingOpponent) return
    setValue((v) => v.slice(0, -1))
  }

  if (waitingOpponent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-8 pt-6">
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
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
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

      <div className="sticky top-0 z-10 -mx-6 mb-2 bg-background/90 px-6 py-5 backdrop-blur">
        <p className="mb-3 text-center text-sm text-muted-foreground">رقمك</p>
        <div className="flex justify-center gap-2.5" dir="ltr">
          {slots.map((d, i) => (
            <div
              key={i}
              className={cn(
                'grid size-14 place-items-center rounded-2xl border-2 font-mono text-3xl font-bold tabular transition-colors',
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

      <p className="mb-4 text-center text-sm text-muted-foreground text-pretty">
        تقدر تكرر نفس الرقم في سرك (مثل 1111). التخمين لاحقًا ممنوع فيه التكرار الكامل.
      </p>

      <div className="flex flex-1 flex-col justify-end gap-5">
        <Keypad onDigit={addDigit} onDelete={del} />

        <button
          type="button"
          onClick={() => valid && onConfirm(value)}
          disabled={!valid}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {valid ? <Check className="size-5" /> : <Lock className="size-5" />}
          تثبيت الرقم
        </button>
      </div>
    </div>
  )
}
