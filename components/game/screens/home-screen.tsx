'use client'

import { useState } from 'react'
import { BarChart3, Brain, CalendarDays, ChevronLeft, Cpu, Flame, Gamepad2, HelpCircle, Home, Laptop, LockKeyhole, Medal, Radio, Settings2, Sparkles, Swords, Trophy, Users, Volume2, VolumeX, Zap } from 'lucide-react'
import { AVATARS, levelFromXp, xpInLevel, type PlayerProfile } from '@/lib/progression'

type View = 'home' | 'play' | 'progress'
type HomeProps = {
  nickname: string; profile: PlayerProfile; muted: boolean; onMuted: (m: boolean) => void
  onProfile: () => void; onCreateRoom: () => void; onRandomMatch: () => void
  onPlayComputer: () => void; onPlayLocal: () => void; onMemory: () => void; onDaily: () => void
  onJoin: (code: string) => void; joinCode: string; onJoinCode: (v: string) => void; onInfo: () => void
}

export function HomeScreen(props: HomeProps) {
  const [view, setView] = useState<View>('home')
  const avatar = AVATARS.find(item => item.id === props.profile.avatar)?.emoji || '🦅'
  const level = levelFromXp(props.profile.xp)
  return <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mx-auto mb-5 flex w-full max-w-md items-center justify-between">
        <button onClick={props.onProfile} className="flex min-w-0 items-center gap-3 text-right"><span className="relative grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[.06] text-2xl">{avatar}<i className="absolute -bottom-1 -left-1 grid size-5 place-items-center rounded-full bg-primary font-mono text-[9px] not-italic text-primary-foreground">{level}</i></span><span className="min-w-0"><small className="block text-[10px] text-muted-foreground">مرحبًا بعودتك</small><b className="block truncate text-base">{props.nickname || 'لاعب'}</b></span></button>
        <div className="flex gap-2"><TopButton label={props.muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={() => props.onMuted(!props.muted)}>{props.muted ? <VolumeX /> : <Volume2 />}</TopButton><TopButton label="المساعدة" onClick={props.onInfo}><HelpCircle /></TopButton></div>
      </header>

      <div className="mx-auto w-full max-w-md">
        {view === 'home' && <HomeView {...props} level={level} />}
        {view === 'play' && <PlayView {...props} />}
        {view === 'progress' && <ProgressView {...props} level={level} />}
      </div>
    </div>

    <nav className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto grid max-w-sm grid-cols-3 rounded-[24px] border border-white/10 bg-[color-mix(in_oklab,var(--card)_88%,transparent)] p-1.5 shadow-[0_18px_60px_rgb(0_0_0/.45)] backdrop-blur-2xl">
      <NavButton active={view === 'home'} icon={Home} label="الرئيسية" onClick={() => setView('home')} />
      <button onClick={() => setView('play')} className={`relative -mt-5 flex flex-col items-center gap-1 text-[9px] font-bold ${view === 'play' ? 'text-primary' : 'text-muted-foreground'}`}><span className={`grid size-13 place-items-center rounded-[18px] border shadow-xl transition-all ${view === 'play' ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-white/10 bg-card text-foreground'}`}><Swords className="size-5" /></span>العب</button>
      <NavButton active={view === 'progress'} icon={BarChart3} label="تقدمي" onClick={() => setView('progress')} />
    </nav>
  </div>
}

function HomeView(props: HomeProps & { level: number }) {
  return <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <section className="relative min-h-64 overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,#ffcc42_0%,#f5a915_55%,#d57809_100%)] p-5 text-[#251704] shadow-[0_28px_70px_-30px_#f5a915]">
      <div className="absolute -left-10 -top-16 size-56 rounded-full border-[36px] border-white/10" /><div className="absolute -bottom-20 -right-12 size-52 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-start justify-between"><span className="rounded-full bg-black/12 px-3 py-1 text-[9px] font-black">اللعب السريع</span><span className="flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1 text-[9px] font-bold"><Radio className="size-3 animate-pulse" />متاح الآن</span></div>
      <div className="relative mt-6"><p className="text-[11px] font-bold opacity-60">المواجهة الكلاسيكية</p><h1 className="mt-1 max-w-64 text-3xl font-black leading-[1.25]">اكتشف الرقم<br />واهزم خصمك</h1></div>
      <div className="relative mt-7 flex items-end justify-between"><button onClick={props.onPlayComputer} className="flex items-center gap-2 rounded-[16px] bg-[#211707] px-5 py-3 text-sm font-black text-[#ffd65b] shadow-lg transition-transform active:scale-95"><Gamepad2 className="size-4" />ابدأ مواجهة</button><div className="flex -space-x-2" dir="ltr">{['7','4','2'].map((d,i)=><span key={d} className="grid size-12 rotate-[-5deg] place-items-center rounded-[14px] border border-black/10 bg-white/22 font-mono text-2xl font-black shadow-md backdrop-blur" style={{transform:`rotate(${(i-1)*6}deg) translateY(${Math.abs(i-1)*5}px)`}}>{d}</span>)}</div></div>
    </section>

    <div className="grid grid-cols-2 gap-3"><button onClick={props.onMemory} className="group flex min-h-32 flex-col justify-between rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(145deg,rgba(16,190,190,.20),rgba(12,32,49,.88))] p-4 text-right shadow-[0_20px_50px_-35px_#22d3ee]"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300"><Brain /></span><span><b className="block">ذاكرة الأرقام</b><small className="mt-1 block text-[10px] text-muted-foreground">درّب تركيزك</small></span></button><button onClick={props.onDaily} className="group flex min-h-32 flex-col justify-between rounded-[24px] border border-violet-400/20 bg-[linear-gradient(145deg,rgba(139,92,246,.22),rgba(29,20,53,.9))] p-4 text-right shadow-[0_20px_50px_-35px_#8b5cf6]"><span className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-violet-400/15 text-violet-300"><CalendarDays /></span><em className="rounded-full bg-violet-300 px-2 py-1 text-[8px] font-black not-italic text-violet-950">يومي</em></span><span><b className="block">تحدي اليوم</b><small className="mt-1 block text-[10px] text-muted-foreground">اربح خبرة إضافية</small></span></button></div>

    <section className="rounded-[24px] border border-white/8 bg-white/[.035] p-4"><div className="flex items-center justify-between"><div><small className="text-[10px] text-muted-foreground">المستوى {props.level}</small><b className="mt-1 block">رحلة الاحتراف</b></div><Medal className="size-6 text-primary" /></div><div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-black/25"><span className="block h-full rounded-full bg-gradient-to-l from-primary to-secondary" style={{width:`${xpInLevel(props.profile.xp)/5}%`}} /></div><span className="font-mono text-[10px] text-muted-foreground">{xpInLevel(props.profile.xp)}/500</span></div></section>
  </div>
}

function PlayView(props: HomeProps) {
  return <div className="animate-in fade-in slide-in-from-left-3 duration-300"><p className="text-[10px] font-black tracking-[.18em] text-secondary">CHOOSE YOUR ARENA</p><h1 className="mt-2 text-3xl font-black">اختر طريقة اللعب</h1><p className="mt-2 text-xs leading-6 text-muted-foreground">كل وضع له تجربة وقوانين مختلفة.</p>
    <div className="mt-6 space-y-3"><Arena icon={Cpu} title="ضد الكمبيوتر" body="ثلاث درجات صعوبة وتقدم محفوظ" tag="فردي" onClick={props.onPlayComputer} color="gold" /><Arena icon={Users} title="خصم عشوائي" body="ندخلك في مواجهة مباشرة" tag="أونلاين" onClick={props.onRandomMatch} color="cyan" /><Arena icon={LockKeyhole} title="غرفة خاصة" body="أنشئ قوانينك وشارك الرمز" tag="أصدقاء" onClick={props.onCreateRoom} color="violet" /><Arena icon={Laptop} title="على نفس الجهاز" body="مرر الجهاز بين لاعبين" tag="محلي" onClick={props.onPlayLocal} color="slate" /></div>
    <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[.035] p-4"><div className="mb-3 flex items-center gap-2"><Zap className="size-4 text-primary" /><b className="text-sm">لديك رمز غرفة؟</b></div><div className="flex gap-2" dir="ltr"><input value={props.joinCode} onChange={e=>props.onJoinCode(e.target.value.toUpperCase().slice(0,5))} placeholder="ABCDE" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-center font-mono text-lg font-black tracking-[.25em] outline-none focus:border-primary/60" /><button onClick={()=>props.onJoin(props.joinCode)} disabled={props.joinCode.length<5} className="rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-30">دخول</button></div></div>
  </div>
}

function ProgressView(props: HomeProps & { level: number }) {
  const winRate = props.profile.games ? Math.round(props.profile.wins/props.profile.games*100) : 0
  return <div className="animate-in fade-in slide-in-from-right-3 duration-300"><p className="text-[10px] font-black tracking-[.18em] text-secondary">PLAYER CAREER</p><h1 className="mt-2 text-3xl font-black">مسيرتك</h1><button onClick={props.onProfile} className="mt-6 flex w-full items-center gap-4 rounded-[26px] bg-gradient-to-l from-primary/20 to-white/[.035] p-4 text-right"><span className="grid size-16 place-items-center rounded-[20px] bg-primary/15 text-4xl">{AVATARS.find(a=>a.id===props.profile.avatar)?.emoji}</span><span className="flex-1"><small className="text-muted-foreground">المستوى {props.level}</small><b className="block text-xl">{props.nickname || 'لاعب'}</b><span className="mt-2 block h-2 overflow-hidden rounded-full bg-black/25"><i className="block h-full rounded-full bg-primary" style={{width:`${xpInLevel(props.profile.xp)/5}%`}} /></span></span><ChevronLeft /></button><div className="mt-4 grid grid-cols-2 gap-3"><Career icon={Trophy} label="الانتصارات" value={props.profile.wins} /><Career icon={Sparkles} label="نسبة الفوز" value={`${winRate}%`} /><Career icon={Flame} label="السلسلة اليومية" value={props.profile.dailyStreak} /><Career icon={Brain} label="أفضل ذاكرة" value={props.profile.memoryBest || '—'} /></div><button onClick={props.onProfile} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] py-4 text-sm font-bold"><Settings2 className="size-4" />الملف والإنجازات والثيمات</button></div>
}

function TopButton({label,onClick,children}:{label:string;onClick:()=>void;children:React.ReactNode}) { return <button aria-label={label} onClick={onClick} className="grid size-10 place-items-center rounded-2xl border border-white/8 bg-white/[.035] text-muted-foreground [&_svg]:size-[18px]">{children}</button> }
function NavButton({active,icon:Icon,label,onClick}:{active:boolean;icon:typeof Home;label:string;onClick:()=>void}) { return <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-2xl py-2 text-[9px] font-bold ${active?'text-primary':'text-muted-foreground'}`}><Icon className="size-[18px]" />{label}</button> }
function Arena({icon:Icon,title,body,tag,onClick,color}:{icon:typeof Cpu;title:string;body:string;tag:string;onClick:()=>void;color:'gold'|'cyan'|'violet'|'slate'}) { const tones={gold:'bg-primary/15 text-primary border-primary/20',cyan:'bg-cyan-400/15 text-cyan-300 border-cyan-400/20',violet:'bg-violet-400/15 text-violet-300 border-violet-400/20',slate:'bg-white/[.06] text-foreground border-white/10'}; return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[22px] border border-white/8 bg-white/[.035] p-3.5 text-right transition-transform active:scale-[.98]"><span className={`grid size-12 place-items-center rounded-2xl border ${tones[color]}`}><Icon className="size-5" /></span><span className="flex-1"><b className="block">{title}</b><small className="mt-1 block text-[10px] text-muted-foreground">{body}</small></span><span className="rounded-full bg-white/[.05] px-2 py-1 text-[8px] text-muted-foreground">{tag}</span><ChevronLeft className="size-4 text-muted-foreground" /></button> }
function Career({icon:Icon,label,value}:{icon:typeof Trophy;label:string;value:string|number}) { return <div className="rounded-[22px] border border-white/8 bg-white/[.035] p-4"><Icon className="size-5 text-secondary" /><b className="mt-4 block font-mono text-2xl">{value}</b><small className="text-[10px] text-muted-foreground">{label}</small></div> }
