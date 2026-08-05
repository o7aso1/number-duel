'use client'

import { useState } from 'react'
import { KeyRound, Target, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: KeyRound,
    title: 'اختر رقمك السري',
    body: 'حدّد رقمًا خاصًا بك — لن يراه خصمك، وعليه أن يخمّنه.',
  },
  {
    icon: Target,
    title: 'خمّن رقم الخصم',
    body: 'بالتناوب تحاولان التخمين. بعد كل محاولة تعرف كم رقمًا وقع في مكانه الصحيح.',
  },
  {
    icon: Trophy,
    title: 'اكسب الجولة',
    body: 'أول من يكشف رقم خصمه بالكامل يفوز ويكبّر سلسلة انتصاراته.',
  },
]

export function Tutorial({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0)
  if (!open) return null

  const current = STEPS[step]
  const Icon = current.icon
  const last = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm animate-in fade-in" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="شرح مبسّط"
        className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        <div
          key={step}
          className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <span className="grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="size-8" />
          </span>
          <h2 className="text-2xl font-bold text-balance">{current.title}</h2>
          <p className="leading-relaxed text-muted-foreground text-pretty">{current.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all',
                i === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onDone}
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            تخطّي
          </button>
          <button
            onClick={() => (last ? onDone() : setStep((s) => s + 1))}
            className="rounded-2xl bg-primary px-7 py-3 font-bold text-primary-foreground transition-all active:scale-95"
          >
            {last ? 'ابدأ اللعب' : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  )
}
