'use client'

import { Logo } from '@/components/game/ui/logo'
import { Brain, ShieldCheck, Swords, Trophy } from 'lucide-react'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

export function LoginScreen({
  onGoogle,
  onGuest,
}: {
  onGoogle: () => void
  onGuest: () => void
}) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute left-1/2 top-[12%] size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[80px]" />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="animate-float-soft relative mb-8 grid size-32 place-items-center rounded-[36px] border border-primary/20 bg-gradient-to-br from-primary/18 to-secondary/10 shadow-[0_30px_70px_-25px_var(--primary)] backdrop-blur-xl">
          <span className="absolute inset-3 rounded-[27px] border border-white/5" /><Logo className="scale-[1.45]" />
        </div>
        <p className="eyebrow animate-in fade-in duration-500">THE ULTIMATE NUMBER GAME</p>
        <h1 className="mt-3 animate-in fade-in slide-in-from-bottom-3 bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-5xl font-black leading-tight tracking-tight text-transparent text-balance duration-500">مبارزة الأرقام</h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground text-pretty animate-in fade-in slide-in-from-bottom-2 duration-700">فكّر، حلّل، واكشف السر قبل خصمك.</p>
        <div className="mt-8 grid w-full grid-cols-3 gap-2.5"><Feature icon={Swords} label="منافسات" /><Feature icon={Brain} label="تحديات" /><Feature icon={Trophy} label="إنجازات" /></div>
      </div>

      {/* Actions */}
      <div className="glass-panel flex flex-col items-center gap-3 rounded-[26px] p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <button
          onClick={onGoogle}
          className="premium-button flex w-full items-center justify-center gap-3 rounded-[17px] px-6 py-4 text-base font-black"
        >
          <span className="grid size-7 place-items-center rounded-full bg-background/90">
            <GoogleMark />
          </span>
          تسجيل الدخول بحساب Google
        </button>
        <button
          onClick={onGuest}
          className="w-full rounded-[15px] border border-white/8 bg-white/[.025] px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
        >
          متابعة كضيف
        </button>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60"><ShieldCheck className="size-3" />دخول آمن · تقدمك محفوظ على جهازك</span>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, label }: { icon: typeof Brain; label: string }) { return <div className="glass-panel flex flex-col items-center gap-2 rounded-[16px] py-3 text-[10px] font-bold text-muted-foreground"><Icon className="size-4 text-secondary" />{label}</div> }
