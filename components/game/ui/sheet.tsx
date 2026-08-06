'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type SheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  /** bottom = phone drawer, center = modal like the old القائمة */
  placement?: 'bottom' | 'center'
  /** Skip max-height scroll — for compact content that should fit the viewport */
  compact?: boolean
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  placement = 'bottom',
  compact = false,
}: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const centered = placement === 'center'

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center p-4',
        centered ? 'items-center' : 'items-end p-0',
      )}
    >
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full max-w-md border border-border bg-popover text-popover-foreground shadow-2xl',
          centered
            ? 'rounded-3xl animate-in zoom-in-95 fade-in duration-200'
            : 'rounded-t-3xl border-x border-t animate-in slide-in-from-bottom-6 duration-300 pb-[max(1rem,env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {!centered && (
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <div
          className={cn(
            'relative flex items-center gap-3 px-5 pb-2 pl-14',
            compact ? 'pt-3' : 'pt-4',
          )}
        >
          {title ? (
            <h2
              className={cn(
                'min-w-0 flex-1 font-bold text-balance',
                compact ? 'text-base' : 'text-lg',
              )}
            >
              {title}
            </h2>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={cn(
              'absolute left-4 grid place-items-center rounded-xl border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground',
              compact ? 'top-2.5 size-8' : 'top-3.5 size-9',
            )}
          >
            <X className={compact ? 'size-4' : 'size-5'} />
          </button>
        </div>
        <div
          className={cn(
            compact ? 'px-3 pb-3 pt-0.5 max-h-none overflow-visible' : 'px-4 pb-5 pt-1',
            !compact &&
              (centered
                ? 'max-h-[min(88dvh,740px)] overflow-y-auto'
                : 'max-h-[70vh] overflow-y-auto'),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
