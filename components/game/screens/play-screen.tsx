'use client'

import { useState } from 'react'
import { Lightbulb, Grid3x3, Timer, Send, Swords } from 'lucide-react'
import { Keypad } from '@/components/game/ui/keypad'
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
  onGuess: (value: string) => void
  onHint: () => void
  onOpenTracker: () => void
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
    <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
      {props.mySecret ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">رقمك</span>
          <span className="font-mono text-xl font-bold tracking-[0.28em] text-primary" dir="ltr">
            {props.mySecret}
          </span>
        </div>
      ) : null}
      {/* Turn banner */}
      <div
        className={cn(
          'flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors',
          props.isMyTurn
            ? 'border-primary/50 bg-primary/15'
            : 'border-border bg-card',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid size-9 place-items-center rounded-xl',
              props.isMyTurn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Swords className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight">
              {props.isMyTurn ? 'دورك الآن' : 'دور الخصم'}
            </span>
            <span className="text-xs text-muted-foreground">
              الجولة رقم <span className="font-mono tabular">{props.turnNumber}</span> · محاولاتك{' '}
              <span className="font-mono tabular">{props.guesses.length}</span>
            </span>
          </div>
        </div>
        {props.timer > 0 && props.secondsLeft !== null && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-bold tabular',
              props.secondsLeft <= 10
                ? 'border-destructive/40 bg-destructive/15 text-destructive'
                : 'border-border bg-background text-foreground',
            )}
          >
            <Timer className="size-4" />
            {props.secondsLeft}
          </div>
        )}
      </div>

      {/* Presence */}
      {props.presence !== 'online' && <PresenceBanner kind={props.presence} className="mt-3" />}

      {/* Current guess slots */}
      <div className="mt-5 flex justify-center gap-2.5" dir="ltr">
        {slots.map((d, i) => (
          <div
            key={i}
            className={cn(
              'grid size-12 place-items-center rounded-xl border-2 font-mono text-2xl font-bold tabular',
              d ? 'border-secondary bg-secondary/10' : 'border-dashed border-border bg-card text-muted-foreground',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {props.hint && (
        <p className="mt-3 text-center text-sm text-secondary animate-in fade-in">{props.hint}</p>
      )}

      {/* History (your guesses only) */}
      <div className="mt-4 flex-1">
        <p className="mb-2 text-sm font-medium text-muted-foreground">محاولاتك</p>
        <div className="flex max-h-44 flex-col gap-2 overflow-y-auto pl-1">
          {props.guesses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
              لا محاولات بعد — خمّن رقم خصمك!
            </p>
          ) : (
            [...props.guesses].reverse().map((g, i) => {
              const idx = props.guesses.length - i
              const won = g.correct === props.length
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 animate-in fade-in slide-in-from-top-1"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-muted-foreground tabular">
                      #{idx}
                    </span>
                    <span className="font-mono text-xl font-bold tracking-widest tabular" dir="ltr">
                      {g.value}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 font-mono text-sm font-bold tabular',
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

      {/* Tools */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={props.onHint}
          disabled={props.hintUsed || !props.isMyTurn}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          <Lightbulb className="size-4 text-primary" />
          تلميح {props.hintUsed && '(مُستخدَم)'}
        </button>
        <button
          onClick={props.onOpenTracker}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold transition-all active:scale-95"
        >
          <Grid3x3 className="size-4 text-secondary" />
          القائمة
        </button>
      </div>

      {/* Keypad */}
      <div className={cn('mt-4', !props.isMyTurn && 'pointer-events-none opacity-50')}>
        <Keypad
          onDigit={(d) => setValue((v) => (v.length < props.length ? v + d : v))}
          onDelete={() => setValue((v) => v.slice(0, -1))}
          disabled={!props.isMyTurn}
        />
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-40"
      >
        <Send className="size-5" />
        {banned ? 'رقم غير مسموح' : props.isMyTurn ? 'خمّن' : 'انتظر دورك'}
      </button>
    </div>
  )
}
