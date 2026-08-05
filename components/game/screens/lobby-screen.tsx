'use client'

import { useState } from 'react'
import { ArrowRight, Copy, Check, Loader2 } from 'lucide-react'
import { PresenceBanner } from '@/components/game/ui/presence-banner'

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}

export function LobbyScreen({
  roomCode,
  nickname,
  onCancel,
}: {
  roomCode: string
  nickname: string
  onCancel: () => void
}) {
  const [copied, setCopied] = useState(false)
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?code=${roomCode}`
      : `?code=${roomCode}`
  const invite = `${nickname || 'صديقك'} يدعوك لمبارزة الأرقام!\nالكود: ${roomCode}\nادخل من هنا: ${inviteUrl}`

  const copy = () => {
    navigator.clipboard?.writeText(invite).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const shareWhatsApp = () => {
    console.log('[v0] share via whatsapp')
    window.open(`https://wa.me/?text=${encodeURIComponent(invite)}`, '_blank')
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-10 pt-6">
      <header className="flex items-center">
        <button
          onClick={onCancel}
          aria-label="رجوع"
          className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="size-5" />
        </button>
        <h1 className="mr-3 text-xl font-bold">الغرفة</h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">رمز الغرفة</p>
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-8 py-4">
            <span className="font-mono text-4xl font-black tracking-[0.35em] tabular text-primary">
              {roomCode}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative flex size-16 items-center justify-center">
            <span className="absolute inline-flex size-16 animate-ping rounded-full bg-secondary/20" />
            <Loader2 className="size-8 animate-spin text-secondary" />
          </div>
          <p className="text-lg font-semibold">بانتظار انضمام الخصم…</p>
          <PresenceBanner kind="wait" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={shareWhatsApp}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-success px-6 py-4 text-lg font-bold text-background transition-all active:scale-[0.98]"
        >
          <WhatsAppMark />
          دعوة عبر واتساب
        </button>
        <button
          onClick={copy}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-6 py-4 font-bold text-foreground transition-all active:scale-[0.98]"
        >
          {copied ? (
            <>
              <Check className="size-5 text-success" />
              تم النسخ
            </>
          ) : (
            <>
              <Copy className="size-5" />
              نسخ رابط الدعوة
            </>
          )}
        </button>
      </div>
    </div>
  )
}
