'use client'

import { useState } from 'react'
import { BarChart3, Grid3x3, KeyRound, Sparkles, Target, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { icon: KeyRound, title: 'اختر سرّك', body: 'اختر من 3 إلى 6 خانات. إعداد المباراة يحدد هل التكرار مسموح.' },
  { icon: Target, title: 'جرّب بنفسك', body: 'السر في المثال 4271. أي تخمين فيه ثلاث خانات صحيحة؟', interactive: true },
  { icon: BarChart3, title: 'راقب الاحتمالات', body: 'كل نتيجة تستبعد أسرارًا مستحيلة. افتح سجل الاحتمالات لتعرف مقدار التقدم.' },
  { icon: Grid3x3, title: 'دوّن استنتاجاتك', body: 'من ملاحظاتي استبعد أي رقم من خانة محددة، واختر التلميح الأنسب وقت الحاجة.' },
  { icon: Trophy, title: 'اجمع نقاطًا أكثر', body: 'الحل الأسرع، والمحاولات الأقل، والتلميحات الأقل تمنحك نتيجة أعلى.' },
]

export function Tutorial({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  if (!open) return null
  const current = STEPS[step]
  const Icon = current.icon
  const last = step === STEPS.length - 1
  const canContinue = !current.interactive || answer === '4021'

  const next = () => {
    if (!canContinue) return
    if (last) onDone()
    else { setStep((value) => value + 1); setAnswer(null) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm animate-in fade-in" />
      <div role="dialog" aria-modal="true" aria-label="شرح تفاعلي" className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div key={step} className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary"><Icon className="size-7" /></span>
          <p className="text-xs font-bold text-primary">خطوة {step + 1} من {STEPS.length}</p>
          <h2 className="text-2xl font-black text-balance">{current.title}</h2>
          <p className="leading-relaxed text-muted-foreground text-pretty">{current.body}</p>

          {current.interactive ? (
            <div className="mt-1 w-full rounded-2xl border border-secondary/30 bg-secondary/10 p-3">
              <div className="mb-3 flex justify-center gap-1.5" dir="ltr">
                {'4271'.split('').map((digit, index) => <span key={index} className="grid size-9 place-items-center rounded-lg bg-card font-mono font-black text-secondary">{digit}</span>)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['4021', '4208'].map((guess) => (
                  <button key={guess} type="button" onClick={() => setAnswer(guess)} className={cn(
                    'rounded-xl border px-3 py-2 font-mono font-bold tracking-widest',
                    answer === guess && guess === '4021' ? 'border-success bg-success/15 text-success' : answer === guess ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-card',
                  )}>{guess}</button>
                ))}
              </div>
              {answer ? <p className={cn('mt-2 text-xs font-bold', answer === '4021' ? 'text-success' : 'text-destructive')}>{answer === '4021' ? 'ممتاز! 4 و2 و1 في أماكنها.' : 'هنا خانتان صحيحتان فقط. جرّب الخيار الآخر.'}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, index) => <span key={index} className={cn('h-1.5 rounded-full transition-all', index === step ? 'w-6 bg-primary' : index < step ? 'w-3 bg-primary/40' : 'w-2 bg-muted-foreground/25')} />)}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={onDone} className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground">تخطّي</button>
          <button type="button" onClick={next} disabled={!canContinue} className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground active:scale-95 disabled:opacity-40">
            {last ? <><Sparkles className="size-4" /> ابدأ اللعب</> : 'التالي'}
          </button>
        </div>
      </div>
    </div>
  )
}
