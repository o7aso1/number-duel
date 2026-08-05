'use client'

import { useState } from 'react'
import { ArrowRight, Lock, Check, ShieldAlert } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { isAllSameDigit } from '@/lib/game'
import { cn } from '@/lib/utils'

export function SetupScreen({
  length,
  onConfirm,
  onBack,
}: {
  length: number
  onConfirm: (secret: string) => void
  onBack: () => void
}) {
  const [value, setValue] = useState('')
  const slots = Array.from({ length }, (_, i) => value[i] ?? '')
  const full = value.length === length
  const banned = full && isAllSameDigit(value)
  const valid = full && !banned

  const addDigit = (d: string) => {
    if (value.length >= length) return
    setValue((v) => v + d)
  }
  const del = () => setValue((v) => v.slice(0, -1))

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <header className="flex items-center">
        <button
          onClick={onBack}
          aria-label="رجوع"
          className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="size-5" />
        </button>
        <h1 className="mr-3 text-xl font-bold">اختر رقمك السري</h1>
      </header>

      {/* Sticky number display */}
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
        لا تخبر خصمك برقمك — سيحاول تخمينه.
      </p>

      <div className="flex flex-1 flex-col justify-end gap-5">
        {banned && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/15 px-4 py-2.5 text-sm font-medium text-destructive animate-in fade-in">
            <ShieldAlert className="size-4 shrink-0" />
            ممنوع تكرار نفس الرقم في كل الخانات
          </div>
        )}

        <Keypad onDigit={addDigit} onDelete={del} />

        <button
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
