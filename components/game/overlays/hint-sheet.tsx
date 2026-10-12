'use client'

import { Binary, Eye, ScanSearch } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import type { HintType } from '@/lib/game'

const HINTS: { id: HintType; title: string; description: string; icon: typeof Eye }[] = [
  { id: 'position', title: 'تحقق من خانة', description: 'يكشف موضعًا صحيحًا من آخر تخمين ناجح.', icon: Eye },
  { id: 'parity', title: 'زوجي أم فردي', description: 'يكشف طبيعة رقم في خانة عشوائية.', icon: Binary },
  { id: 'exclude', title: 'استبعاد ذكي', description: 'يستبعد رقمًا خاطئًا من إحدى الخانات.', icon: ScanSearch },
]

export function HintSheet({ open, onClose, remaining, onChoose }: {
  open: boolean
  onClose: () => void
  remaining: number
  onChoose: (type: HintType) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="اختر تلميحًا" placement="center" compact>
      <p className="mb-3 text-center text-sm text-muted-foreground">
        متبقي لك <span className="font-mono font-bold text-primary">{remaining}</span>
      </p>
      <div className="flex flex-col gap-2">
        {HINTS.map(({ id, title, description, icon: Icon }) => (
          <button key={id} type="button" disabled={remaining < 1} onClick={() => onChoose(id)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right transition-all hover:border-primary/50 active:scale-[0.98] disabled:opacity-40">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="size-5" /></span>
            <span><span className="block font-bold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
