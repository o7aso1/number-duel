'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Sheet } from '@/components/game/ui/sheet'
import type { ChatMessage } from '@/lib/game'
import { cn } from '@/lib/utils'

export function ChatSheet({
  open,
  onClose,
  messages,
  myPlayerId,
  onSend,
}: {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
  myPlayerId: string | null
  onSend: (body: string) => Promise<boolean> | boolean
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [open, messages.length])

  const submit = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const ok = await onSend(body)
    setSending(false)
    if (ok) setText('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="محادثة الغرفة" placement="center">
      <div className="flex h-[min(52dvh,420px)] flex-col gap-3">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-card/60 p-3">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              ابدأ المحادثة — اكتب رسالة لخصمك.
            </p>
          ) : (
            messages.map((m) => {
              const mine = myPlayerId != null && m.playerId === myPlayerId
              return (
                <div
                  key={m.id}
                  className={cn('flex flex-col gap-0.5', mine ? 'items-start' : 'items-end')}
                >
                  <span className="px-1 text-[11px] text-muted-foreground">
                    {mine ? 'أنت' : m.playerName}
                  </span>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed text-pretty',
                      mine
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-muted text-foreground rounded-tl-md',
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder="اكتب رسالة…"
            maxLength={200}
            className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="إرسال"
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </Sheet>
  )
}
