'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, Bot, ChevronLeft, Grid3x3, Lightbulb, MessageCircle, Send, ShieldCheck, Sparkles, Swords, UserRound } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { TurnTimerRing } from '@/components/game/ui/turn-timer-ring'
import { PresenceBanner, type PresenceKind } from '@/components/game/ui/presence-banner'
import { MODE_PRESETS, isAllSameDigit, hasUniqueDigits, type GameMode, type Guess } from '@/lib/game'
import { useDigitKeyboard } from '@/lib/use-digit-keyboard'
import { cn } from '@/lib/utils'

type PlayProps = {
  length: number
  allowRepeats: boolean
  gameMode: GameMode
  maxAttempts: number
  score: number
  isMyTurn: boolean
  turnNumber: number
  guesses: Guess[]
  timer: number
  secondsLeft: number | null
  hintsRemaining: number
  hint: string | null
  presence: PresenceKind
  mySecret?: string
  showChat?: boolean
  unreadChat?: number
  keyboardEnabled?: boolean
  onGuess: (value: string) => void
  onHint: () => void
  onOpenTracker: () => void
  onOpenProbabilities: () => void
  onOpenChat?: () => void
  onExit: () => void
}

export function PlayScreen(props: PlayProps) {
  const { isMyTurn, length, onGuess } = props
  const [value, setValue] = useState('')
  const [impact, setImpact] = useState<{ correct: number; id: number } | null>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const full = value.length === length
  const bannedAllSame = full && isAllSameDigit(value)
  const repeated = full && !props.allowRepeats && !hasUniqueDigits(value)
  const attemptsLeft = Math.max(0, props.maxAttempts - props.guesses.length)
  const canSubmit = props.isMyTurn && full && !bannedAllSame && !repeated && attemptsLeft > 0
  const lastGuess = props.guesses.at(-1)

  useEffect(() => {
    if (!lastGuess) return
    setImpact({ correct: lastGuess.correct, id: Date.now() })
    const timeout = setTimeout(() => setImpact(null), 1150)
    return () => clearTimeout(timeout)
  }, [lastGuess])

  const slots = Array.from({ length: props.length }, (_, i) => value[i] ?? '')

  const submit = useCallback(() => {
    if (!isMyTurn || attemptsLeft < 1) return
    if (value.length !== length || isAllSameDigit(value)) return
    if (!props.allowRepeats && !hasUniqueDigits(value)) return
    onGuess(value)
    setValue('')
  }, [attemptsLeft, isMyTurn, length, onGuess, props.allowRepeats, value])

  useDigitKeyboard({
    enabled: Boolean(props.keyboardEnabled && props.isMyTurn),
    maxLength: props.length,
    value,
    onChange: setValue,
    onSubmit: submit,
  })

  const submitLabel = bannedAllSame
    ? 'التكرار الكامل ممنوع'
    : repeated
      ? 'الأرقام يجب أن تختلف'
      : attemptsLeft < 1
        ? 'انتهت محاولاتك'
        : props.isMyTurn ? 'خمّن' : 'انتظر دورك'

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-5 pt-[max(.75rem,env(safe-area-inset-top))]" onTouchStart={event => { const touch = event.touches[0]; touchRef.current = { x: touch.clientX, y: touch.clientY } }} onTouchEnd={event => { const start = touchRef.current; if (!start) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (dy < -60 && Math.abs(dy) > Math.abs(dx)) submit(); else if (Math.abs(dx) > 60) setValue(current => current.slice(0, -1)); touchRef.current = null }}>
      {impact && impact.correct > 0 ? (
        <div key={impact.id} className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-hidden">
          <div className="absolute inset-0 animate-correct-flash bg-success/20" />
          <div className="relative flex flex-col items-center animate-correct-burst">
            <Sparkles className="size-16 text-success drop-shadow-[0_0_24px_currentColor]" />
            <span className="mt-2 rounded-full border border-success/50 bg-background/90 px-5 py-2 text-xl font-black text-success shadow-2xl">
              {impact.correct} في مكانه!
            </span>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <button type="button" aria-label="العودة" onClick={props.onExit} className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-muted-foreground active:scale-95"><ChevronLeft className="size-5 rotate-180" /></button>
          <div className="text-center"><span className="block text-[9px] font-black tracking-[.2em] text-secondary">NUMBER DUEL</span><b className="mt-0.5 block text-sm">{MODE_PRESETS[props.gameMode].label}</b></div>
          {props.showChat ? <button type="button" aria-label="المحادثة" onClick={props.onOpenChat} className="relative grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04]"><MessageCircle className="size-[18px] text-secondary" />{(props.unreadChat || 0) > 0 && <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[9px] font-black text-white">{props.unreadChat}</span>}</button> : <span className="size-10" />}
        </header>

        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.015))] p-4 shadow-2xl">
          <div className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Fighter icon={UserRound} label="أنت" detail={`${props.score.toLocaleString('ar-SA')} نقطة`} active={props.isMyTurn} />
            <div className="flex flex-col items-center"><span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-primary/10 font-mono text-xs font-black text-primary">VS</span><small className="mt-2 text-[9px] text-muted-foreground">جولة {props.turnNumber}</small></div>
            <Fighter icon={Bot} label="الخصم" detail={props.isMyTurn ? 'يراقب' : 'يفكر الآن'} active={!props.isMyTurn} />
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3">
            <BattleStat label="المتبقي" value={`${attemptsLeft}`} />
            <BattleStat label="الخانات" value={`${props.length}`} />
            <BattleStat label="التلميحات" value={`${props.hintsRemaining}`} />
          </div>
        </section>

        {props.mySecret ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />رقمك السري</span>
            <span className="font-mono text-base font-black tracking-[0.28em] text-primary" dir="ltr">{props.mySecret}</span>
          </div>
        ) : null}

        <div className={cn('flex items-center justify-between rounded-[22px] border px-4 py-3 transition-all', props.isMyTurn ? 'border-primary/25 bg-primary/8' : 'border-white/8 bg-white/[.025]')}>
          <div className="flex items-center gap-3"><span className={cn('grid size-10 place-items-center rounded-2xl', props.isMyTurn ? 'bg-primary text-primary-foreground' : 'bg-white/[.05] text-muted-foreground')}><Swords className="size-[18px]" /></span><div><span className="block text-sm font-black">{props.isMyTurn ? 'حل الشفرة الآن' : 'الخصم يحاول الحل'}</span><span className="text-[10px] text-muted-foreground">استخدم كل نتيجة لتضييق الاحتمالات</span></div></div>
          {props.isMyTurn && props.timer > 0 && props.secondsLeft !== null && <TurnTimerRing total={props.timer} left={props.secondsLeft} />}
        </div>

        {props.presence !== 'online' && <PresenceBanner kind={props.presence} />}

        <div className="flex justify-center gap-2 py-1" dir="ltr">
          {slots.map((d, i) => <div key={i} className={cn(
            'relative grid place-items-center rounded-[16px] border font-mono text-2xl font-black tabular transition-all after:absolute after:inset-x-2 after:bottom-1.5 after:h-0.5 after:rounded-full',
            props.length >= 6 ? 'size-11' : 'size-14',
            d ? 'border-primary/45 bg-primary/12 text-primary shadow-[0_12px_30px_-18px_var(--primary)] after:bg-primary' : 'border-white/10 bg-black/20 text-muted-foreground after:bg-white/10',
          )}>{d}</div>)}
        </div>

        {props.hint && <p className="rounded-xl border border-secondary/25 bg-secondary/10 px-3 py-2 text-center text-sm text-secondary animate-in fade-in">{props.hint}</p>}

        <section className="rounded-[22px] border border-white/8 bg-white/[.025] p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black text-muted-foreground">سجل المواجهة</p><span className="font-mono text-[9px] text-muted-foreground">{props.guesses.length}/{props.maxAttempts}</span></div>
          <div className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
            {props.guesses.length === 0 ? <p className="rounded-[14px] border border-dashed border-white/10 px-3 py-3 text-center text-[10px] text-muted-foreground">أدخل أول تخمين لبدء تحليل الشفرة</p> : [...props.guesses].reverse().map((guess, reverseIndex) => {
              const index = props.guesses.length - reverseIndex
              const won = guess.correct === props.length
              return <div key={`${guess.value}-${index}`} className={cn('flex items-center justify-between rounded-xl border bg-black/10 px-3 py-1.5 animate-in fade-in', reverseIndex === 0 && guess.correct > 0 ? 'border-success/50' : 'border-white/8')}>
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">#{index}</span><span className="font-mono text-lg font-bold tracking-widest" dir="ltr">{guess.value}</span></div>
                <span className={cn('rounded-full px-2.5 py-0.5 font-mono text-sm font-bold', won ? 'bg-success/20 text-success' : guess.correct > 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{guess.correct} صح</span>
              </div>
            })}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <ActionButton onClick={props.onHint} disabled={props.hintsRemaining < 1 || !props.isMyTurn} icon={Lightbulb} label={`تلميح (${props.hintsRemaining})`} />
          <ActionButton onClick={props.onOpenTracker} icon={Grid3x3} label="ملاحظاتي" tone="secondary" />
          <ActionButton onClick={props.onOpenProbabilities} icon={BarChart3} label="الاحتمالات" tone="secondary" />
        </div>

        <div className={cn('rounded-[26px] border border-white/10 bg-black/20 p-3 shadow-[0_22px_60px_-38px_rgb(0_0_0)]', !props.isMyTurn && 'pointer-events-none opacity-50')}>
          <Keypad onDigit={(digit) => setValue((current) => current.length < props.length ? current + digit : current)} onDelete={() => setValue((current) => current.slice(0, -1))} disabled={!props.isMyTurn || attemptsLeft < 1} />
          <button type="button" onClick={submit} disabled={!canSubmit} className="premium-button mt-3 flex w-full items-center justify-center gap-2.5 rounded-[17px] px-6 py-3.5 text-base font-black disabled:opacity-35"><Send className="size-5" /> {submitLabel}</button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">على الجوال: اسحب للأعلى للتخمين أو جانبًا للحذف</p>
      </div>
    </div>
  )
}

function Fighter({ icon: Icon, label, detail, active }: { icon: typeof UserRound; label: string; detail: string; active: boolean }) { return <div className={cn('flex flex-col items-center rounded-[20px] border px-2 py-3 text-center transition-all', active ? 'border-primary/25 bg-primary/8' : 'border-white/5 bg-black/10')}><span className={cn('grid size-10 place-items-center rounded-2xl', active ? 'bg-primary text-primary-foreground' : 'bg-white/[.06] text-muted-foreground')}><Icon className="size-5" /></span><b className="mt-2 text-xs">{label}</b><small className="mt-0.5 whitespace-nowrap text-[8px] text-muted-foreground">{detail}</small></div> }

function BattleStat({ label, value }: { label: string; value: string }) { return <div className="text-center"><b className="block font-mono text-base text-foreground">{value}</b><small className="text-[8px] text-muted-foreground">{label}</small></div> }

function ActionButton({ onClick, disabled, icon: Icon, label, tone = 'primary' }: { onClick: () => void; disabled?: boolean; icon: typeof Lightbulb; label: string; tone?: 'primary' | 'secondary' }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="glass-panel flex flex-col items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-[10px] font-bold transition-transform active:scale-95 disabled:opacity-35"><Icon className={cn('size-4', tone === 'primary' ? 'text-primary' : 'text-secondary')} />{label}</button>
}
