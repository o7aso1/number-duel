'use client'

import { Sheet } from '@/components/game/ui/sheet'

const RULES = [
  'كل لاعب يختار رقمًا سريًا بعدد الخانات المحدّد.',
  'بالتناوب، يحاول كل لاعب تخمين رقم خصمه.',
  'النتيجة = عدد الأرقام الصحيحة في مكانها الصحيح فقط.',
  'ممنوع تكرار نفس الرقم في كل الخانات (مثل 1111).',
  'أول من يخمّن رقم خصمه بالكامل يفوز بالجولة.',
]

export function InfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="كيف تلعب">
      <ol className="flex flex-col gap-3">
        {RULES.map((rule, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-sm font-bold tabular text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed text-pretty">{rule}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm leading-relaxed text-pretty">
        مثال: رقمك السري <span className="font-mono font-bold text-secondary">4271</span> —
        وخمّن الخصم <span className="font-mono font-bold text-secondary">4021</span>، تكون النتيجة{' '}
        <span className="font-bold text-foreground">3 صح</span> (الأرقام 4 و 2 و 1 في أماكنها).
      </div>
    </Sheet>
  )
}
