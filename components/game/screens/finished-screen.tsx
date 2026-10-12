'use client'

import { Frown, Handshake, Home, ImageDown, Play, RotateCcw, Star, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchOutcome } from '@/lib/game'

const COPY = {
  win: { title: 'فزت بالجولة!', body: 'كشفت رقم الخصم قبل نفاد محاولاتك.', icon: Trophy },
  lose: { title: 'خسرت هذه المرة', body: 'حلّل سجل الاحتمالات وجرّب خطة مختلفة.', icon: Frown },
  draw: { title: 'تعادل!', body: 'انتهت محاولات الطرفين دون كشف السر.', icon: Handshake },
}

export function FinishedScreen({ outcome, opponentSecret, attempts, streak, score, elapsedSeconds, onRematch, onHome, onReplay, onShare }: {
  outcome: MatchOutcome
  opponentSecret: string
  attempts: number
  streak: number
  score: number
  elapsedSeconds: number
  onRematch: () => void
  onHome: () => void
  onReplay: () => void
  onShare: () => void
}) {
  const item = COPY[outcome]
  const Icon = item.icon
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-6 text-center">
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <span className={cn('animate-float-soft grid size-24 place-items-center rounded-[30px] border shadow-[0_24px_70px_-25px_var(--primary)]', outcome === 'win' ? 'border-primary/30 bg-primary/15 text-primary' : outcome === 'draw' ? 'border-secondary/30 bg-secondary/15 text-secondary' : 'border-white/10 bg-muted text-muted-foreground')}><Icon className="size-11" /></span>
        <div><h1 className="text-3xl font-black text-balance">{item.title}</h1><p className="mt-2 text-sm text-muted-foreground text-pretty">{item.body}</p></div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <div className="glass-panel rounded-[22px] border-primary/25 px-4 py-5">
          <p className="mb-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><Star className="size-4 text-primary" /> نقاط المباراة</p>
          <span className="font-mono text-4xl font-black tabular text-primary">{score.toLocaleString('ar-SA')}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">رقم الخصم السري</p>
          <span className="font-mono text-2xl font-black tracking-[0.25em] tabular text-secondary" dir="ltr">{opponentSecret || '—'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="محاولاتك" value={attempts} />
          <MiniStat label="الوقت" value={`${minutes}:${String(seconds).padStart(2, '0')}`} />
          <MiniStat label="السلسلة" value={streak} />
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <button onClick={onRematch} className="premium-button flex w-full items-center justify-center gap-2.5 rounded-[17px] px-6 py-3.5 text-base font-black"><RotateCcw className="size-5" /> تحدٍّ جديد</button>
        <div className="grid grid-cols-2 gap-2"><button onClick={onReplay} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-bold"><Play className="size-4" />إعادة المباراة</button><button onClick={onShare} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-bold"><ImageDown className="size-4" />مشاركة النتيجة</button></div>
        <button onClick={onHome} className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-6 py-3.5 font-bold"><Home className="size-5" /> الرئيسية</button>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="glass-panel rounded-[14px] px-2 py-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-base font-black tabular">{value}</p></div>
}
