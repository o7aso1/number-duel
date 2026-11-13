'use client'

import { useCallback, useRef, useState } from 'react'
import { BarChart3, Bot, ChevronLeft, Grid3x3, Lightbulb, MessageCircle, Send, ShieldCheck, Swords, UserRound } from 'lucide-react'
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
  probabilityHistory?: { before: number; after: number }[]
  marked?: Set<string>
  timer: number
  secondsLeft: number | null
  hintsRemaining: number
  hint: string | null
  error?: string | null
  presence: PresenceKind
  opponentIsCpu?: boolean
  mySecret?: string
  showChat?: boolean
  unreadChat?: number
  keyboardEnabled?: boolean
  onGuess: (value: string) => boolean | Promise<boolean>
  onHint?: () => void
  onOpenTracker?: () => void
  onOpenProbabilities?: () => void
  onOpenChat?: () => void
  onExit: () => void
}

export function PlayScreen(props: PlayProps) {
  const { isMyTurn, length, onGuess } = props
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submittingRef = useRef(false)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const full = value.length === length
  const bannedAllSame = full && isAllSameDigit(value)
  const repeated = full && !props.allowRepeats && !hasUniqueDigits(value)
  const attemptsLeft = Math.max(0, props.maxAttempts - props.guesses.length)
  const canSubmit = props.isMyTurn && !submitting && full && !bannedAllSame && !repeated && attemptsLeft > 0
  const lastGuess = props.guesses.at(-1)

  const slots = Array.from({ length: props.length }, (_, i) => value[i] ?? '')
  const fullyExcluded = Array.from({ length: 10 }, (_, digit) => digit).filter(digit =>
    Array.from({ length: props.length }, (_, slot) => props.marked?.has(`${digit}-${slot}`)).every(Boolean),
  )

  const submit = useCallback(async () => {
    if (!isMyTurn || attemptsLeft < 1 || submittingRef.current) return
    if (value.length !== length || isAllSameDigit(value)) return
    if (!props.allowRepeats && !hasUniqueDigits(value)) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      if (await onGuess(value)) setValue('')
    } catch {
      setSubmitError('تعذّر إرسال التخمين. تحقق من الاتصال وحاول مجددًا.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [attemptsLeft, isMyTurn, length, onGuess, props.allowRepeats, value])

  useDigitKeyboard({
    enabled: Boolean(props.keyboardEnabled && props.isMyTurn && !submitting),
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
        : submitting ? 'جارٍ إرسال التخمين…' : props.isMyTurn ? 'تأكيد التخمين' : 'انتظر دورك'

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-5 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-7 lg:px-10 lg:pb-10 lg:pt-7" onTouchStart={event => { const touch = event.touches[0]; touchRef.current = { x: touch.clientX, y: touch.clientY } }} onTouchEnd={event => { const start = touchRef.current; if (!start) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (dy < -60 && Math.abs(dy) > Math.abs(dx)) submit(); else if (Math.abs(dx) > 60) setValue(current => current.slice(0, -1)); touchRef.current = null }}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <button type="button" aria-label="العودة" onClick={props.onExit} className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-muted-foreground active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ChevronLeft className="size-5 rotate-180" /></button>
          <h1 className="text-center text-base font-black">مبارزة الأرقام <span className="font-normal text-muted-foreground">/ {MODE_PRESETS[props.gameMode].label}</span></h1>
          {props.showChat ? <button type="button" aria-label="المحادثة" onClick={props.onOpenChat} className="relative grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><MessageCircle className="size-[18px] text-secondary" />{(props.unreadChat || 0) > 0 && <span className="absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[9px] font-black text-white">{props.unreadChat}</span>}</button> : <span className="size-10" />}
        </header>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] xl:gap-7">
        <div className="order-2 flex min-w-0 flex-col gap-3 md:col-start-2 md:row-start-1">
        <section aria-label="حالة المواجهة" className="rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className={cn('flex items-center gap-1.5 font-bold', props.isMyTurn ? 'text-primary' : 'text-foreground')}><UserRound className="size-4" />أنت</span>
            <span className="text-muted-foreground">ضد</span>
            <span className={cn('flex items-center gap-1.5 font-bold', !props.isMyTurn ? 'text-primary' : 'text-foreground')}>{props.opponentIsCpu ? <Bot className="size-4" /> : <UserRound className="size-4" />}{props.opponentIsCpu ? 'الكمبيوتر' : 'الخصم'}</span>
            <span className="ms-auto text-muted-foreground">جولة {props.turnNumber}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-2 text-[11px] text-muted-foreground">
            <span>باقي <b className="text-foreground">{attemptsLeft}/{props.maxAttempts}</b> محاولة</span>
            <span><b className="text-foreground">{props.length}</b> خانات</span>
            <span>حتى <b className="text-foreground">{props.score.toLocaleString('ar-SA')}</b> نقطة</span>
          </div>
        </section>

        {props.mySecret ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />رقمك السري</span>
            <span className="font-mono text-base font-black tracking-[0.28em] text-primary" dir="ltr">{props.mySecret}</span>
          </div>
        ) : null}

        {props.presence !== 'online' && <PresenceBanner kind={props.presence} />}

        <section aria-label="سجل التخمينات" className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="text-base font-black">سجل التخمينات</h2><p className="text-[11px] text-muted-foreground">النتيجة تحسب الأرقام الصحيحة في مكانها</p></div><span className="font-mono text-xs text-muted-foreground">{props.guesses.length}/{props.maxAttempts}</span></div>
          <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto md:max-h-[min(52vh,480px)]">
            {props.guesses.length === 0 ? <li className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-xs text-muted-foreground">سيظهر أول تخمين ونتيجته هنا.</li> : [...props.guesses].reverse().map((guess, reverseIndex) => {
              const index = props.guesses.length - reverseIndex
              const step = props.probabilityHistory?.[index - 1]
              return <li key={`${guess.value}-${index}`} className={cn('rounded-xl border px-3 py-2.5', reverseIndex === 0 ? 'match-history-reveal border-primary/40 bg-primary/[.07]' : 'border-white/8 bg-black/10')}>
                <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">#{index}</span><span className="font-mono text-lg font-bold tracking-widest" dir="ltr">{guess.value}</span></div><span className={cn('text-xs font-bold', guess.correct ? 'text-primary' : 'text-muted-foreground')}>{guess.correct} من {props.length} في مكانه</span></div>
                {step && <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/8 pt-1.5 text-[11px] text-muted-foreground"><span>الاحتمالات المتبقية</span><span className="font-mono text-foreground">من {step.before.toLocaleString('ar-SA')} إلى {step.after.toLocaleString('ar-SA')}</span></div>}
              </li>
            })}
          </ol>
        </section>

        {(props.onHint || props.onOpenTracker || props.onOpenProbabilities) && <div className="grid grid-cols-3 gap-2">
          {props.onHint && <ActionButton onClick={props.onHint} disabled={props.hintsRemaining < 1 || !props.isMyTurn} icon={Lightbulb} label={`تلميح (${props.hintsRemaining})`} />}
          {props.onOpenTracker && <ActionButton onClick={props.onOpenTracker} icon={Grid3x3} label="ملاحظاتي" tone="secondary" />}
          {props.onOpenProbabilities && <ActionButton onClick={props.onOpenProbabilities} icon={BarChart3} label="الاحتمالات" tone="secondary" />}
        </div>}
        {props.onOpenTracker && <button type="button" onClick={props.onOpenTracker} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 text-right text-xs text-muted-foreground hover:border-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span>ملاحظاتي · {props.marked?.size ? `${props.marked.size} مواضع مستبعدة` : 'لم تستبعد أرقامًا بعد'}</span><span className="flex flex-wrap justify-end gap-1" dir="ltr">{fullyExcluded.length ? fullyExcluded.map(digit => <span key={digit} className="grid size-6 place-items-center rounded-md bg-destructive/10 font-mono text-destructive line-through">{digit}</span>) : <span className="text-secondary">فتح</span>}</span></button>}
        </div>

        <section aria-label="إدخال التخمين" className="order-1 flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 md:col-start-1 md:row-start-1 md:p-5 xl:p-6">
        <div className="flex min-h-12 items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className={cn('grid size-9 place-items-center rounded-xl', props.isMyTurn ? 'bg-primary/15 text-primary' : 'bg-white/8 text-muted-foreground')}><Swords className="size-[18px]" /></span><div><h2 className="text-base font-black">{props.isMyTurn ? 'حل شفرة الخصم' : 'دور الخصم'}</h2><p className="text-[11px] text-muted-foreground">{props.isMyTurn ? `المحاولة ${Math.min(props.guesses.length + 1, props.maxAttempts)} من ${props.maxAttempts}` : 'سيعود الإدخال عند وصول دورك'}</p></div></div>{props.isMyTurn && props.timer > 0 && props.secondsLeft !== null && <TurnTimerRing total={props.timer} left={props.secondsLeft} size={48} />}</div>
        <div className="mx-auto flex w-full max-w-[460px] justify-center gap-2 py-2" dir="ltr" aria-label="التخمين الحالي">
          {slots.map((d, i) => <div key={i} className={cn(
            'relative grid min-w-0 flex-1 place-items-center rounded-xl border font-mono text-2xl font-black tabular transition-colors after:absolute after:inset-x-2 after:bottom-1.5 after:h-0.5 after:rounded-full',
            props.length >= 6 ? 'h-13 max-w-14' : 'h-14 max-w-16 md:h-13 xl:h-16',
            d ? 'border-primary/45 bg-primary/12 text-primary shadow-[0_12px_30px_-18px_var(--primary)] after:bg-primary' : 'border-white/10 bg-black/20 text-muted-foreground after:bg-white/10',
          )}>{d}</div>)}
        </div>

        {lastGuess && <p key={`${props.guesses.length}-${lastGuess.value}`} role="status" className="match-result-reveal mx-auto w-full max-w-[460px] rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-center text-xs font-bold text-primary">آخر تخمين {lastGuess.value}: {lastGuess.correct} من {props.length} في مكانه</p>}
        {!!props.marked?.size && props.onOpenTracker && <button type="button" onClick={props.onOpenTracker} className="mx-auto w-full max-w-[460px] rounded-lg px-2 py-1 text-center text-[11px] text-secondary underline underline-offset-4 md:hidden">ملاحظاتك: {props.marked.size} مواضع مستبعدة{fullyExcluded.length ? ` · أرقام مستبعدة كليًا: ${fullyExcluded.join('، ')}` : ''}</button>}
        {props.hint && <p role="status" className="rounded-xl border border-secondary/25 bg-secondary/10 px-3 py-2 text-center text-sm text-secondary animate-in fade-in">{props.hint}</p>}
        {(submitError || props.error) && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">{submitError || props.error}</p>}

        <p aria-live="polite" className="min-h-5 text-center text-xs text-muted-foreground">
          {bannedAllSame ? 'التخمين المكوّن من رقم واحد مكرر بالكامل ممنوع.' : repeated ? 'اختر أرقامًا مختلفة حسب قوانين هذه المباراة.' : props.isMyTurn ? `المحاولة ${Math.min(props.guesses.length + 1, props.maxAttempts)} من ${props.maxAttempts} · أدخل ${props.length} أرقام` : 'سيعود إدخال الرقم عند وصول دورك.'}
        </p>

        <div className={cn('mx-auto w-full max-w-[460px] rounded-2xl border border-white/10 bg-black/20 p-3', !props.isMyTurn && 'opacity-50')}>
          <Keypad onDigit={(digit) => { setSubmitError(''); setValue((current) => current.length < props.length ? current + digit : current) }} onDelete={() => { setSubmitError(''); setValue((current) => current.slice(0, -1)) }} disabled={!props.isMyTurn || attemptsLeft < 1 || submitting} />
          <button type="button" onClick={submit} disabled={!canSubmit} className="premium-button mt-3 flex w-full items-center justify-center gap-2.5 rounded-[17px] px-6 py-3.5 text-base font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-35"><Send className="size-5" /> {submitLabel}</button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground md:hidden">على الجوال: اسحب للأعلى للتخمين أو جانبًا للحذف</p>
        </section>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ onClick, disabled, icon: Icon, label, tone = 'primary' }: { onClick: () => void; disabled?: boolean; icon: typeof Lightbulb; label: string; tone?: 'primary' | 'secondary' }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="glass-panel flex flex-col items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-[10px] font-bold transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-35"><Icon className={cn('size-4', tone === 'primary' ? 'text-primary' : 'text-secondary')} />{label}</button>
}
