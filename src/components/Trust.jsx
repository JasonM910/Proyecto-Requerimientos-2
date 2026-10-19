import { BadgeCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Insignia pública: solo indica si el proveedor completó la verificación (simulada en el prototipo).
export function VerifiedBadge({ className, compact = false }) {
  return <Badge variant="secondary" className={cn('gap-1 rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-mint-foreground', className)} title="Proveedor con identidad verificada">
    <BadgeCheck className="size-3.5" aria-hidden="true" />{compact ? <span className="sr-only">Verificado</span> : 'Verificado'}
  </Badge>
}
