'use client'

import { LogOut } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'

export function ConfirmExitSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="تأكيد الخروج" placement="center">
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground text-pretty">
        متأكد تبي تطلع من المواجهة؟ ما راح تقدر ترجع لنفس الجولة إذا طلعت.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-border bg-card py-3.5 text-base font-bold transition-all active:scale-[0.98]"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-base font-bold text-destructive-foreground transition-all active:scale-[0.98]"
        >
          <LogOut className="size-4" />
          خروج
        </button>
      </div>
    </Sheet>
  )
}
