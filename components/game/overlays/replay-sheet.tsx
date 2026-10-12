'use client'

import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sheet } from '@/components/game/ui/sheet'
import type { Guess } from '@/lib/game'

export function ReplaySheet({ open, onClose, guesses, length }: { open: boolean; onClose: () => void; guesses: Guess[]; length: number }) {
  const [step, setStep] = useState(0)
  useEffect(() => { if (open) setStep(guesses.length ? 1 : 0) }, [open, guesses.length])
  const current = guesses[step - 1]
  return <Sheet open={open} onClose={onClose} title="إعادة المباراة" placement="center">
    <div className="space-y-4 text-center">
      {!current ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">لا توجد محاولات مسجلة.</p> : <>
        <div className="rounded-2xl border border-border bg-card p-5"><Eye className="mx-auto size-6 text-secondary" /><p className="mt-2 text-xs text-muted-foreground">الخطوة {step} من {guesses.length}</p><p className="mt-4 font-mono text-4xl font-black tracking-[0.25em]" dir="ltr">{current.value}</p><p className="mt-3 text-sm font-bold text-primary">{current.correct} من {length} في مكانه الصحيح</p></div>
        <div className="grid grid-cols-2 gap-2"><button disabled={step <= 1} onClick={() => setStep(s => s - 1)} className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-3 font-bold disabled:opacity-35"><ChevronRight className="size-4" />السابق</button><button disabled={step >= guesses.length} onClick={() => setStep(s => s + 1)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-35">التالي<ChevronLeft className="size-4" /></button></div>
      </>}
    </div>
  </Sheet>
}
