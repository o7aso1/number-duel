'use client'

import { useState } from 'react'
import {
  Lightbulb,
  Grid3x3,
  Send,
  Swords,
  LogOut,
  MessageCircle,
} from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
import { TurnTimerRing } from '@/components/game/ui/turn-timer-ring'
import { PresenceBanner, type PresenceKind } from '@/components/game/ui/presence-banner'
import { isAllSameDigit, type Guess } from '@/lib/game'
import { cn } from '@/lib/utils'

type PlayProps = {
  length: number
  isMyTurn: boolean
  turnNumber: number
  guesses: Guess[]
  timer: number
  secondsLeft: number | null
  hintUsed: boolean
  hint: string | null
  presence: PresenceKind
  mySecret?: string
  showChat?: boolean
  unreadChat?: number
  onGuess: (value: string) => void
  onHint: () => void
  onOpenTracker: () => void
  onOpenChat?: () => void
  onExit: () => void
}

export function PlayScreen(props: PlayProps) {
  const [value, setValue] = useState('')
  const full = value.length === props.length
  const banned = full && isAllSameDigit(value)
  const canSubmit = props.isMyTurn && full && !banned

  const slots = Array.from({ length: props.length }, (_, i) => value[i] ?? '')

  const submit = () => {
    if (!canSubmit) return
    props.onGuess(value)
    setValue('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={props.onExit}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="size-4" />
            خروج
          </button>
          {props.showChat ? (
            <button
              type="button"
              onClick={props.onOpenChat}
              className="relative flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors"
            >
              <MessageCircle className="size-4 text-secondary" />
              شات
              {(props.unreadChat || 0) > 0 && (
                <span className="absolute -top-1 -left-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {props.unreadChat}
                </span>
              )}
            </button>
          ) : (
            <span />
          )}
        </div>

        {props.mySecret ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2">
            <span className="text-sm text-muted-foreground">رقمك</span>
            <span className="font-mono text-lg font-bold tracking-[0.28em] text-primary" dir="ltr">
              {props.mySecret}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            'flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-colors',
            props.isMyTurn ? 'border-primary/50 bg-primary/15' : 'border-border bg-card',
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                props.isMyTurn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Swords className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-bold leading-tight">
                {props.isMyTurn ? 'دورك الآن' : 'دور الخصم'}
              </span>
              <span className="text-xs text-muted-foreground">
                الجولة <span className="font-mono tabular">{props.turnNumber}</span> · محاولاتك{' '}
                <span className="font-mono tabular">{props.guesses.length}</span>
              </span>
            </div>
          </div>
          {props.timer > 0 && props.secondsLeft !== null && (
            <TurnTimerRing total={props.timer} left={props.secondsLeft} />
          )}
        </div>

        {props.presence !== 'online' && <PresenceBanner kind={props.presence} />}

        <div className="flex justify-center gap-2" dir="ltr">
          {slots.map((d, i) => (
            <div
              key={i}
              className={cn(
                'grid size-11 place-items-center rounded-xl border-2 font-mono text-xl font-bold tabular',
                d
                  ? 'border-secondary bg-secondary/10'
                  : 'border-dashed border-border bg-card text-muted-foreground',
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {props.hint && (
          <p className="text-center text-sm text-secondary animate-in fade-in">{props.hint}</p>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-muted-foreground">محاولاتك</p>
          <div className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
            {props.guesses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-3 py-3 text-center text-sm text-muted-foreground">
                لا محاولات بعد — خمّن رقم خصمك!
              </p>
            ) : (
              [...props.guesses].reverse().map((g, i) => {
                const idx = props.guesses.length - i
                const won = g.correct === props.length
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground tabular">#{idx}</span>
                      <span
                        className="font-mono text-lg font-bold tracking-widest tabular"
                        dir="ltr"
                      >
                        {g.value}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 font-mono text-sm font-bold tabular',
                        won ? 'bg-success/20 text-success' : 'bg-primary/15 text-primary',
                      )}
                    >
                      {g.correct} صح
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={props.onHint}
            disabled={props.hintUsed || !props.isMyTurn}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            <Lightbulb className="size-4 text-primary" />
            تلميح {props.hintUsed && '(مُستخدَم)'}
          </button>
          <button
            type="button"
            onClick={props.onOpenTracker}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold transition-all active:scale-95"
          >
            <Grid3x3 className="size-4 text-secondary" />
            القائمة
          </button>
        </div>

        <div className={cn(!props.isMyTurn && 'pointer-events-none opacity-50')}>
          <Keypad
            onDigit={(d) => setValue((v) => (v.length < props.length ? v + d : v))}
            onDelete={() => setValue((v) => v.slice(0, -1))}
            disabled={!props.isMyTurn}
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-3.5 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <Send className="size-5" />
          {banned ? 'رقم غير مسموح' : props.isMyTurn ? 'خمّن' : 'انتظر دورك'}
        </button>
      </div>
    </div>
  )
}
