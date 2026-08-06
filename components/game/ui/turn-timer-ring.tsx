'use client'

import { cn } from '@/lib/utils'

export function TurnTimerRing({
  total,
  left,
  size = 56,
}: {
  total: number
  left: number
  size?: number
}) {
  const safeTotal = Math.max(1, total)
  const clamped = Math.max(0, Math.min(left, safeTotal))
  const progress = clamped / safeTotal
  const r = 18
  const c = 2 * Math.PI * r
  const dash = c * progress

  let stroke = 'var(--primary)'
  if (clamped <= 5) stroke = '#ef4444'
  else if (clamped <= 10) stroke = '#f97316'
  else if (clamped <= safeTotal / 2) stroke = '#eab308'

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-label={`الوقت المتبقي ${clamped} ثانية`}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-muted/40"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray,stroke] duration-300 ease-linear"
        />
      </svg>
      <span
        className={cn(
          'relative z-[1] font-mono text-sm font-bold tabular',
          clamped <= 5 && 'text-red-500',
          clamped > 5 && clamped <= 10 && 'text-orange-500',
          clamped > 10 && clamped <= safeTotal / 2 && 'text-yellow-500',
        )}
      >
        {clamped}
      </span>
    </div>
  )
}
