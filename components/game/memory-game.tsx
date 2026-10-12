'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Brain, CalendarDays, Heart, RotateCcw, Send, Sparkles, Trophy } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { playSfx } from '@/lib/sfx'
import { seededDigits, todayKey } from '@/lib/progression'
import { useDigitKeyboard } from '@/lib/use-digit-keyboard'

type Phase = 'ready' | 'show' | 'input' | 'result' | 'finished'

function randomDigits(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

export function MemoryGame({ daily, muted, onExit, onComplete }: {
  daily: boolean; muted: boolean; onExit: () => void
  onComplete: (result: { bestLength: number; score: number; xp: number; daily: boolean; wonDaily: boolean }) => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [round, setRound] = useState(1)
  const [lives, setLives] = useState(3)
  const [sequence, setSequence] = useState('')
  const [value, setValue] = useState('')
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(false)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const length = Math.min(12, round + 2)
  const targetRounds = daily ? 7 : 10

  const startRound = useCallback((nextRound = round) => {
    const nextLength = Math.min(12, nextRound + 2)
    setValue('')
    setSequence(daily ? seededDigits(`${todayKey()}:${nextRound}`, nextLength) : randomDigits(nextLength))
    setPhase('show')
  }, [daily, round])

  useEffect(() => {
    if (phase !== 'show') return
    const delay = Math.max(900, 1550 - length * 45)
    const timer = setTimeout(() => setPhase('input'), delay)
    return () => clearTimeout(timer)
  }, [length, phase])

  const finish = useCallback((finalScore: number, wonDaily: boolean, completed: boolean) => {
    setPhase('finished')
    const bestLength = Math.min(12, round + (completed ? 2 : 1))
    onComplete({ bestLength, score: finalScore, xp: Math.max(40, Math.round(finalScore / 8)), daily, wonDaily })
  }, [daily, onComplete, round])

  const submit = useCallback(() => {
    if (phase !== 'input' || value.length !== sequence.length) return
    const ok = value === sequence
    setCorrect(ok)
    setPhase('result')
    if (ok) {
      const nextScore = score + sequence.length * 120
      setScore(nextScore)
      playSfx(muted, 'success')
      navigator.vibrate?.([25, 25, 45])
      if (round >= targetRounds) setTimeout(() => finish(nextScore, daily, true), 650)
      else setTimeout(() => { const next = round + 1; setRound(next); startRound(next) }, 650)
    } else {
      const nextLives = lives - 1
      setLives(nextLives)
      playSfx(muted, 'fail')
      navigator.vibrate?.(60)
      if (daily || nextLives <= 0) setTimeout(() => finish(score, false, false), 800)
      else setTimeout(() => startRound(round), 800)
    }
  }, [daily, finish, lives, muted, phase, round, score, sequence, startRound, targetRounds, value])

  useDigitKeyboard({ enabled: phase === 'input', maxLength: sequence.length, value, onChange: setValue, onSubmit: submit })

  const reset = () => { setRound(1); setLives(3); setScore(0); setCorrect(false); setValue(''); setPhase('ready') }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchRef.current
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dy) > 60 && dy < 0) submit()
    else if (Math.abs(dx) > 60) setValue(v => v.slice(0, -1))
    touchRef.current = null
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]" onTouchStart={e => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY } }} onTouchEnd={onTouchEnd}>
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
      <header className="flex items-center justify-between"><button onClick={onExit} className="glass-panel grid size-11 place-items-center rounded-[15px] text-muted-foreground transition-transform active:scale-90"><ArrowRight className="size-5" /></button><div className="text-center"><p className="eyebrow">FOCUS MODE</p><h1 className="mt-1 text-lg font-black">{daily ? 'التحدي اليومي' : 'ذاكرة الأرقام'}</h1><p className="text-[10px] text-muted-foreground">{daily ? todayKey() : 'تذكّر ثم اكتب'}</p></div><span className="animate-pulse-ring grid size-11 place-items-center rounded-[15px] border border-secondary/20 bg-secondary/12 text-secondary"><Brain className="size-5" /></span></header>

      <div className="grid grid-cols-3 gap-2.5"><Mini label="الجولة" value={`${round}/${targetRounds}`} /><Mini label="النقاط" value={score.toLocaleString('ar-SA')} /><Mini label="المحاولات" value={<span className="flex justify-center gap-0.5">{Array.from({ length: daily ? 1 : 3 }, (_, i) => <Heart key={i} className={`size-4 ${i < lives ? 'fill-destructive text-destructive' : 'text-muted'}`} />)}</span>} /></div>

      <div className="glass-panel relative flex min-h-56 flex-1 flex-col items-center justify-center overflow-hidden rounded-[28px] p-6 text-center"><span className="pointer-events-none absolute -top-24 size-56 rounded-full bg-secondary/10 blur-[70px]" />
        {phase === 'ready' && <><span className="animate-float-soft relative grid size-24 place-items-center rounded-[28px] border border-secondary/25 bg-gradient-to-br from-secondary/20 to-primary/10 text-secondary shadow-[0_24px_60px_-25px_var(--secondary)]"><Brain className="size-11" /></span><p className="eyebrow mt-7">MEMORY CHALLENGE</p><h2 className="mt-2 text-2xl font-black">{daily ? 'نفس التحدي للجميع' : 'اختبر ذاكرتك'}</h2><p className="mt-2 max-w-64 text-xs leading-6 text-muted-foreground">سيظهر رقم لثوانٍ. احفظه ثم اكتبه بالترتيب.</p><button onClick={() => startRound(1)} className="premium-button mt-7 w-full max-w-56 rounded-[16px] px-8 py-3.5 font-black">ابدأ التحدي</button></>}
        {phase === 'show' && <><p className="eyebrow mb-5">احفظ الرقم</p><p className="relative break-all font-mono text-5xl font-black tracking-[0.18em] text-primary drop-shadow-[0_0_25px_color-mix(in_oklab,var(--primary)_35%,transparent)] animate-in zoom-in" dir="ltr">{sequence}</p><div className="mt-8 h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/5"><div className="h-full origin-right animate-[memory-countdown_1.2s_linear_forwards] bg-gradient-to-l from-primary to-secondary shadow-[0_0_12px_var(--primary)]" /></div></>}
        {phase === 'input' && <><p className="mb-4 text-sm text-muted-foreground">ما الرقم الذي ظهر؟</p><div className="flex flex-wrap justify-center gap-1.5" dir="ltr">{Array.from({ length: sequence.length }, (_, i) => <span key={i} className="grid size-9 place-items-center rounded-lg border border-border bg-background font-mono text-lg font-bold">{value[i] || ''}</span>)}</div></>}
        {phase === 'result' && <><span className="text-5xl">{correct ? '✅' : '❌'}</span><h2 className="mt-3 text-xl font-black">{correct ? 'ممتاز!' : 'الرقم الصحيح'}</h2>{!correct && <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-secondary" dir="ltr">{sequence}</p>}</>}
        {phase === 'finished' && <><Trophy className="size-16 text-primary" /><h2 className="mt-4 text-3xl font-black">{daily && correct ? 'أنجزت تحدي اليوم!' : 'نتيجتك'}</h2><p className="mt-2 font-mono text-4xl font-black text-primary">{score.toLocaleString('ar-SA')}</p><p className="mt-2 text-sm text-muted-foreground">وصلت إلى {length} خانات</p><div className="mt-6 flex w-full gap-2"><button onClick={reset} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"><RotateCcw className="size-4" />إعادة</button><button onClick={onExit} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 font-bold">الرئيسية</button></div></>}
      </div>

      {phase === 'input' && <><Keypad onDigit={digit => setValue(v => v.length < sequence.length ? v + digit : v)} onDelete={() => setValue(v => v.slice(0, -1))} /><button onClick={submit} disabled={value.length !== sequence.length} className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-lg font-bold text-primary-foreground disabled:opacity-40"><Send className="size-5" />تأكيد</button><p className="text-center text-[10px] text-muted-foreground">اسحب للأعلى للتأكيد أو جانبًا للحذف</p></>}
      {daily && phase === 'ready' && <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-muted-foreground"><CalendarDays className="size-4 text-primary" />يتغيّر التحدي عند منتصف الليل ويعرض التسلسل نفسه للجميع.</div>}
      {phase === 'result' && correct && <Sparkles className="pointer-events-none fixed left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 text-success animate-correct-burst" />}
    </div>
  </div>
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) { return <div className="glass-panel rounded-[16px] p-2.5 text-center"><span className="block text-[9px] text-muted-foreground">{label}</span><b className="mt-1 block font-mono text-sm text-foreground">{value}</b></div> }
