import { Wifi, WifiOff, Hourglass, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PresenceKind = 'online' | 'offline' | 'wait' | 'left'

const CONFIG: Record<
  PresenceKind,
  { icon: typeof Wifi; text: string; tone: string }
> = {
  online: {
    icon: Wifi,
    text: 'الخصم متصل',
    tone: 'bg-success/15 text-success border-success/30',
  },
  offline: {
    icon: WifiOff,
    text: 'انقطع الاتصال… جارٍ إعادة المحاولة',
    tone: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  wait: {
    icon: Hourglass,
    text: 'الخصم يفكر ويخمّن…',
    tone: 'bg-secondary/15 text-secondary border-secondary/30',
  },
  left: {
    icon: LogOut,
    text: 'غادر الخصم الغرفة',
    tone: 'bg-muted text-muted-foreground border-border',
  },
}

export function PresenceBanner({
  kind,
  className,
}: {
  kind: PresenceKind
  className?: string
}) {
  const { icon: Icon, text, tone } = CONFIG[kind]
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
        tone,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-pretty">{text}</span>
    </div>
  )
}
