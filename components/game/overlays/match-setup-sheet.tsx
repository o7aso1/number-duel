'use client'

import { Check, Cpu, Gauge, Repeat2, Shield, Sparkles, Target, Users } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import { DIFFICULTY_LABELS, MODE_PRESETS, type CpuDifficulty, type Difficulty, type GameMode } from '@/lib/game'
import { cn } from '@/lib/utils'

export type MatchMode = 'create' | 'cpu' | 'local'

const DIFFICULTIES: Difficulty[] = [3, 4, 5, 6]
const GAME_MODES: { id: GameMode; icon: typeof Gauge }[] = [
  { id: 'normal', icon: Shield },
  { id: 'quick', icon: Gauge },
  { id: 'expert', icon: Sparkles },
  { id: 'one-shot', icon: Target },
]

const META: Record<MatchMode, { title: string; action: string; icon: typeof Users }> = {
  create: { title: 'إعداد الغرفة', action: 'إنشاء الغرفة', icon: Users },
  cpu: { title: 'إعداد المواجهة', action: 'ابدأ المواجهة', icon: Cpu },
  local: { title: 'لعب محلي', action: 'ابدأ على هذا الجهاز', icon: Users },
}

export function MatchSetupSheet({
  open, onClose, matchMode, difficulty, onDifficulty, gameMode, onGameMode,
  allowRepeats, onAllowRepeats, cpuDifficulty, onCpuDifficulty, busy, onConfirm,
}: {
  open: boolean
  onClose: () => void
  matchMode: MatchMode
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  gameMode: GameMode
  onGameMode: (mode: GameMode) => void
  allowRepeats: boolean
  onAllowRepeats: (value: boolean) => void
  cpuDifficulty: CpuDifficulty
  onCpuDifficulty: (value: CpuDifficulty) => void
  busy?: boolean
  onConfirm: () => void
}) {
  const meta = META[matchMode]
  const preset = MODE_PRESETS[gameMode]
  const Icon = meta.icon

  return (
    <Sheet open={open} onClose={onClose} title={meta.title} placement="center">
      <div className="flex max-h-[74dvh] flex-col gap-5 overflow-y-auto px-0.5 pb-1">
        <section>
          <p className="mb-2 text-sm font-medium text-muted-foreground">نمط المباراة</p>
          <div className="grid grid-cols-2 gap-2">
            {GAME_MODES.map(({ id, icon: ModeIcon }) => {
              const item = MODE_PRESETS[id]
              return (
                <button key={id} type="button" onClick={() => onGameMode(id)} className={cn(
                  'flex items-start gap-2.5 rounded-xl border p-3 text-right transition-all active:scale-[0.98]',
                  gameMode === id ? 'border-primary bg-primary/15' : 'border-border bg-card text-muted-foreground',
                )}>
                  <ModeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-bold text-foreground">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-4">{item.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {matchMode === 'cpu' && <section><p className="mb-2 text-sm font-medium text-muted-foreground">مستوى الكمبيوتر</p><div className="grid grid-cols-3 gap-2">{([['easy','سهل'],['medium','متوسط'],['hard','ذكي']] as const).map(([id,label]) => <button key={id} onClick={() => onCpuDifficulty(id)} className={cn('rounded-xl border py-2.5 text-sm font-bold', cpuDifficulty === id ? 'border-secondary bg-secondary/15' : 'border-border bg-card text-muted-foreground')}>{label}</button>)}</div></section>}

        {matchMode === 'create' && <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">أنت تحدد قوانين الغرفة، ويحصل من ينضم على نفس الإعدادات تلقائيًا.</p>}
        {matchMode === 'local' && <p className="rounded-xl border border-secondary/25 bg-secondary/10 px-3 py-2 text-xs text-muted-foreground">كل لاعب يختار سره ثم يسلّم الجهاز للآخر. تُخفى الأسرار بين الأدوار.</p>}

        <section>
          <p className="mb-2 text-sm font-medium text-muted-foreground">عدد الخانات</p>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button key={d} type="button" onClick={() => onDifficulty(d)} className={cn(
                'flex flex-col items-center rounded-xl border py-2.5 transition-all active:scale-95',
                difficulty === d ? 'border-primary bg-primary/15 text-foreground' : 'border-border bg-card text-muted-foreground',
              )}>
                <span className="font-mono text-2xl font-black tabular text-primary">{d}</span>
                <span className="text-[10px] font-medium">{DIFFICULTY_LABELS[d]}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium text-muted-foreground">تكرار الأرقام</p>
          <div className="grid grid-cols-2 gap-2">
            <RuleButton active={allowRepeats} onClick={() => onAllowRepeats(true)} icon={Repeat2} title="مسموح" description="مثل 1214" />
            <RuleButton active={!allowRepeats} onClick={() => onAllowRepeats(false)} icon={Shield} title="بدون تكرار" description="كل رقم مرة" />
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-muted/40 p-3 text-center">
          <Summary label="المحاولات" value={preset.maxAttempts} />
          <Summary label="التلميحات" value={preset.hintLimit} />
          <Summary label="وقت الدور" value={preset.timer ? `${preset.timer}ث` : 'مفتوح'} />
        </div>

        <button type="button" disabled={busy} onClick={onConfirm} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-50">
          {busy ? 'جارٍ…' : <><Icon className="size-5" />{meta.action}<Check className="size-4 opacity-70" /></>}
        </button>
      </div>
    </Sheet>
  )
}

function RuleButton({ active, onClick, icon: Icon, title, description }: {
  active: boolean; onClick: () => void; icon: typeof Repeat2; title: string; description: string
}) {
  return (
    <button type="button" onClick={onClick} className={cn(
      'flex items-center gap-2 rounded-xl border p-3 text-right transition-all active:scale-95',
      active ? 'border-secondary bg-secondary/15' : 'border-border bg-card text-muted-foreground',
    )}>
      <Icon className="size-5 text-secondary" />
      <span><span className="block text-sm font-bold text-foreground">{title}</span><span className="block text-[11px]">{description}</span></span>
    </button>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-bold tabular text-foreground">{value}</p></div>
}
