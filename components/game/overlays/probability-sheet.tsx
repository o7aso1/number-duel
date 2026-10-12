'use client'

import { ChartNoAxesColumnDecreasing, ChevronLeft } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import type { Guess } from '@/lib/game'

export type ProbabilityStep = { before: number; after: number }

const format = new Intl.NumberFormat('ar-SA')

export function ProbabilitySheet({ open, onClose, guesses, history }: {
  open: boolean
  onClose: () => void
  guesses: Guess[]
  history: ProbabilityStep[]
}) {
  const initial = history[0]?.before ?? 0
  const remaining = history.at(-1)?.after ?? initial
  const progress = initial && remaining < initial ? Math.max(2, Math.round((1 - remaining / initial) * 100)) : 0

  return (
    <Sheet open={open} onClose={onClose} title="تقلّص الاحتمالات" placement="center">
      <div className="mb-4 rounded-2xl border border-secondary/30 bg-secondary/10 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold"><ChartNoAxesColumnDecreasing className="size-5 text-secondary" /> المتبقي</span>
          <span className="font-mono text-2xl font-black tabular text-secondary">{format.format(remaining)}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" dir="ltr">
          <div className="h-full rounded-full bg-secondary transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">استبعدت نتائجك {progress}% من مساحة الأسرار الأصلية.</p>
      </div>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {!guesses.length ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">سيظهر السجل بعد أول تخمين.</p> : guesses.map((guess, index) => {
          const step = history[index]
          return (
            <div key={`${guess.value}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3" dir="ltr">
              <span className="font-mono font-bold tracking-widest">{guess.value}</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{guess.correct} صح</span>
              <span className="mr-auto flex items-center gap-1 font-mono text-xs tabular text-muted-foreground">
                {format.format(step?.before ?? 0)} <ChevronLeft className="size-3" /> <b className="text-foreground">{format.format(step?.after ?? 0)}</b>
              </span>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
