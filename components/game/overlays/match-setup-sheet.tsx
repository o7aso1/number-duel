'use client'

import { Users, Cpu, Check } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import { DIFFICULTY_LABELS, type Difficulty, type TimerOption } from '@/lib/game'
import { cn } from '@/lib/utils'

export type MatchMode = 'create' | 'cpu'

const DIFFICULTIES: Difficulty[] = [3, 4, 5]
const TIMERS: TimerOption[] = [0, 30, 45, 60]

const META: Record<
  MatchMode,
  { title: string; action: string; icon: typeof Users; showTimer: boolean }
> = {
  create: { title: 'إنشاء غرفة', action: 'إنشاء', icon: Users, showTimer: true },
  cpu: { title: 'ضد الكمبيوتر', action: 'ابدأ', icon: Cpu, showTimer: true },
}

export function MatchSetupSheet({
  open,
  onClose,
  mode,
  difficulty,
  onDifficulty,
  timer,
  onTimer,
  busy,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  mode: MatchMode
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  timer: TimerOption
  onTimer: (t: TimerOption) => void
  busy?: boolean
  onConfirm: () => void
}) {
  const meta = META[mode]
  const Icon = meta.icon

  return (
    <Sheet open={open} onClose={onClose} title={meta.title} placement="center">
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">الصعوبة</p>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDifficulty(d)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-all active:scale-95',
                  difficulty === d
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                <span className="text-sm font-medium">{DIFFICULTY_LABELS[d]}</span>
                <span className="font-mono text-2xl font-bold tabular text-primary">{d}</span>
              </button>
            ))}
          </div>
        </div>

        {meta.showTimer && (
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">مؤقّت الدور</p>
            <div className="grid grid-cols-4 gap-2">
              {TIMERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTimer(t)}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-semibold transition-all active:scale-95',
                    timer === t
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {t === 0 ? 'بدون' : <span className="font-mono tabular">{t}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            'جارٍ…'
          ) : (
            <>
              <Icon className="size-5" />
              {meta.action}
              <Check className="size-4 opacity-70" />
            </>
          )}
        </button>
      </div>
    </Sheet>
  )
}
