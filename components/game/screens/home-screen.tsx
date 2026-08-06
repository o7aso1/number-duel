'use client'

import {
  Info,
  Volume2,
  VolumeX,
  Users,
  Cpu,
  Sun,
  MoonStar,
  Trees,
  Flame,
  Trophy,
  Shuffle,
} from 'lucide-react'
import { Logo } from '@/components/game/ui/logo'
import type { ThemeName } from '@/lib/game'
import { cn } from '@/lib/utils'

type HomeProps = {
  nickname: string
  onNickname: (v: string) => void
  theme: ThemeName
  onTheme: (t: ThemeName) => void
  muted: boolean
  onMuted: (m: boolean) => void
  streak: number
  bestStreak: number
  onCreateRoom: () => void
  onRandomMatch: () => void
  onPlayComputer: () => void
  onJoin: (code: string) => void
  joinCode: string
  onJoinCode: (v: string) => void
  onInfo: () => void
}

const THEMES: { id: ThemeName; label: string; icon: typeof Sun }[] = [
  { id: 'classic', label: 'كلاسيك', icon: MoonStar },
  { id: 'oasis', label: 'واحة', icon: Trees },
  { id: 'day', label: 'نهاري', icon: Sun },
]

export function HomeScreen(props: HomeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="scale-90" />
          </div>
          <div className="flex items-center gap-2">
            <IconToggle
              active={!props.muted}
              onClick={() => props.onMuted(!props.muted)}
              ariaLabel={props.muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            >
              {props.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </IconToggle>
            <IconToggle active={false} onClick={props.onInfo} ariaLabel="التعليمات">
              <Info className="size-5" />
            </IconToggle>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Flame} label="سلسلتك" value={props.streak} tone="primary" />
          <StatCard icon={Trophy} label="أفضل سلسلة" value={props.bestStreak} tone="secondary" />
        </div>

        <Field label="اسمك في اللعبة">
          <input
            value={props.nickname}
            onChange={(e) => props.onNickname(e.target.value)}
            placeholder="اكتب اسمك"
            maxLength={16}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-lg font-semibold outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </Field>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={props.onCreateRoom}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-primary px-2 py-4 text-center text-sm font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
          >
            <Users className="size-5" />
            إنشاء غرفة
          </button>
          <button
            type="button"
            onClick={props.onRandomMatch}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 px-2 py-4 text-center text-sm font-bold text-foreground transition-all active:scale-[0.98]"
          >
            <Shuffle className="size-5 text-primary" />
            لعب عشوائي
          </button>
          <button
            type="button"
            onClick={props.onPlayComputer}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-secondary/40 bg-secondary/15 px-2 py-4 text-center text-sm font-bold text-foreground transition-all active:scale-[0.98]"
          >
            <Cpu className="size-5 text-secondary" />
            ضد الكمبيوتر
          </button>
        </div>

        <Field label="عندك رمز غرفة؟">
          <div className="flex gap-2" dir="ltr">
            <input
              value={props.joinCode}
              onChange={(e) => props.onJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="ABCDE"
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] tabular outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => props.onJoin(props.joinCode)}
              disabled={props.joinCode.length < 5}
              className="shrink-0 rounded-xl bg-foreground px-6 font-bold text-background transition-all active:scale-95 disabled:opacity-40"
            >
              انضم
            </button>
          </div>
        </Field>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">الثيم</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => props.onTheme(t.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-all active:scale-95',
                    props.theme === t.id
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function IconToggle({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'grid size-10 place-items-center rounded-full border transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Flame
  label: string
  value: number
  tone: 'primary' | 'secondary'
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span
        className={cn(
          'grid size-10 place-items-center rounded-xl',
          tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary',
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-2xl font-bold tabular leading-none">{value}</span>
      </div>
    </div>
  )
}
