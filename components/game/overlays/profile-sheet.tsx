'use client'

import { Award, Check, Lock, Palette, Star, Target, Timer, Trophy } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import { ACHIEVEMENTS, AVATARS, levelFromXp, unlockedThemes, xpInLevel, type AvatarId, type PlayerProfile } from '@/lib/progression'
import type { ThemeName } from '@/lib/game'
import { cn } from '@/lib/utils'

const THEMES: { id: ThemeName; label: string; level: number; swatch: string }[] = [
  { id: 'classic', label: 'كلاسيكي', level: 1, swatch: 'bg-amber-400' },
  { id: 'neon', label: 'نيون', level: 2, swatch: 'bg-lime-400' },
  { id: 'space', label: 'فضائي', level: 4, swatch: 'bg-violet-500' },
  { id: 'paper', label: 'ورقي', level: 6, swatch: 'bg-stone-300' },
]

export function ProfileSheet({ open, onClose, name, onName, profile, onAvatar, theme, onTheme }: {
  open: boolean; onClose: () => void; name: string; onName: (name: string) => void
  profile: PlayerProfile; onAvatar: (avatar: AvatarId) => void; theme: ThemeName; onTheme: (theme: ThemeName) => void
}) {
  const level = levelFromXp(profile.xp)
  const unlocked = unlockedThemes(profile)
  const winRate = profile.games ? Math.round(profile.wins / profile.games * 100) : 0
  const average = profile.games ? (profile.totalAttempts / profile.games).toFixed(1) : '—'
  return <Sheet open={open} onClose={onClose} title="ملفي الشخصي" placement="center">
    <div className="flex max-h-[78dvh] flex-col gap-5 overflow-y-auto px-0.5 pb-1">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="grid size-16 place-items-center rounded-2xl bg-primary/15 text-4xl">{AVATARS.find(a => a.id === profile.avatar)?.emoji}</span>
        <div className="min-w-0 flex-1">
          <input value={name} onChange={e => onName(e.target.value.slice(0, 16))} placeholder="اسم اللاعب" className="w-full bg-transparent text-xl font-black outline-none" />
          <p className="mt-1 text-xs text-muted-foreground">المستوى {level} · {profile.xp.toLocaleString('ar-SA')} XP</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${xpInLevel(profile.xp) / 5}%` }} /></div>
        </div>
      </div>

      <section><Title icon={Star}>الصورة الرمزية</Title><div className="grid grid-cols-6 gap-2">{AVATARS.map(avatar => <button key={avatar.id} onClick={() => onAvatar(avatar.id)} aria-label={avatar.label} className={cn('grid aspect-square place-items-center rounded-xl border text-2xl', profile.avatar === avatar.id ? 'border-primary bg-primary/15' : 'border-border bg-card')}>{avatar.emoji}</button>)}</div></section>

      <section><Title icon={Trophy}>إحصائياتي</Title><div className="grid grid-cols-3 gap-2"><Stat icon={Target} label="نسبة الفوز" value={`${winRate}%`} /><Stat icon={Award} label="متوسط المحاولات" value={average} /><Stat icon={Timer} label="أسرع حل" value={profile.fastestSolve === null ? '—' : `${profile.fastestSolve}ث`} /></div></section>

      <section><Title icon={Palette}>الثيمات</Title><div className="grid grid-cols-2 gap-2">{THEMES.map(item => { const available = unlocked.includes(item.id); return <button key={item.id} disabled={!available} onClick={() => onTheme(item.id)} className={cn('flex items-center gap-2 rounded-xl border p-3 text-right', theme === item.id ? 'border-primary bg-primary/15' : 'border-border bg-card', !available && 'opacity-55')}><span className={cn('size-6 rounded-full border border-white/20', item.swatch)} /><span className="flex-1 text-sm font-bold">{item.label}</span>{available ? theme === item.id ? <Check className="size-4 text-primary" /> : null : <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Lock className="size-3" /> م{item.level}</span>}</button> })}</div></section>

      <section><Title icon={Award}>الإنجازات</Title><div className="space-y-2">{ACHIEVEMENTS.map(item => { const earned = profile.achievements.includes(item.id); return <div key={item.id} className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', !earned && 'grayscale opacity-45')}><span className="text-2xl">{item.icon}</span><span className="flex-1"><b className="block text-sm">{item.title}</b><span className="text-xs text-muted-foreground">{item.description}</span></span>{earned && <Check className="size-4 text-success" />}</div> })}</div></section>
    </div>
  </Sheet>
}

function Title({ icon: Icon, children }: { icon: typeof Star; children: React.ReactNode }) { return <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-primary" />{children}</h3> }
function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-2 text-center"><Icon className="mx-auto size-4 text-secondary" /><b className="mt-1 block font-mono text-lg">{value}</b><span className="text-[9px] text-muted-foreground">{label}</span></div> }
