'use client'

import { Trophy, Frown, RotateCcw, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FinishedScreen({
  won,
  opponentSecret,
  turns,
  streak,
  onRematch,
  onHome,
}: {
  won: boolean
  opponentSecret: string
  turns: number
  streak: number
  onRematch: () => void
  onHome: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 pt-6 text-center">
      <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-500">
        <span
          className={cn(
            'grid size-24 place-items-center rounded-3xl',
            won ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {won ? <Trophy className="size-12" /> : <Frown className="size-12" />}
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-balance">
            {won ? 'فزت بالجولة!' : 'خسرت هذه المرة'}
          </h1>
          <p className="text-muted-foreground text-pretty">
            {won ? 'كشفت رقم الخصم أولًا. أحسنت!' : 'الخصم كان أسرع هذه المرة.'}
          </p>
        </div>
      </div>

      {/* Reveal + stats */}
      <div className="w-full max-w-xs space-y-3">
        <div className="rounded-2xl border border-border bg-card px-4 py-4">
          <p className="mb-2 text-sm text-muted-foreground">رقم الخصم السري كان</p>
          <span className="font-mono text-3xl font-black tracking-[0.3em] tabular text-secondary" dir="ltr">
            {opponentSecret}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="عدد الجولات" value={turns} />
          <MiniStat label="سلسلتك" value={streak} />
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onRematch}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
        >
          <RotateCcw className="size-5" />
          تحدٍّ جديد
        </button>
        <button
          onClick={onHome}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-6 py-4 font-bold text-foreground transition-all active:scale-[0.98]"
        >
          <Home className="size-5" />
          الرئيسية
        </button>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-bold tabular">{value}</p>
    </div>
  )
}
