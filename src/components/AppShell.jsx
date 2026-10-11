import { ChevronRight, ClipboardList, Layers3, LayoutGrid, LogOut, Search, Sparkles, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import Brand from '@/Brand'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const providerNavigation = [
  { id: 'servicios', label: 'Mis servicios', mobileLabel: 'Servicios', icon: LayoutGrid },
  { id: 'perfil', label: 'Mi perfil', mobileLabel: 'Mi perfil', icon: UserRound },
  { id: 'solicitudes', label: 'Solicitudes recibidas', mobileLabel: 'Solicitudes', icon: Layers3 },
]

const clientNavigation = [
  { id: 'solicitudes', label: 'Mis solicitudes', mobileLabel: 'Solicitudes', icon: ClipboardList },
  { id: 'buscar', label: 'Buscar servicios', mobileLabel: 'Buscar', icon: Search },
  { id: 'perfil', label: 'Mi perfil', mobileLabel: 'Mi perfil', icon: UserRound },
]

function AppShell({ user, view, onViewChange, onLogout, alerts = 0, children }) {
  const provider = user?.role === 'Proveedor'
  const navigation = provider ? providerNavigation : clientNavigation
  const title = navigation.find((item) => item.id === view)?.label || 'Mi espacio'
  const subtitle = provider ? 'ESPACIO DEL PROVEEDOR' : 'ESPACIO DEL CLIENTE'

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-[254px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-4 pb-5 pt-8 lg:flex">
        <Brand subtitle={subtitle} className="px-3" />
        <p className="mb-3 mt-14 px-3 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">MENÚ PRINCIPAL</p>
        <nav className="grid gap-1.5" aria-label={provider ? 'Navegación del proveedor' : 'Navegación del cliente'}>
          {navigation.map(({ id, label, icon: Icon }) => (
            <Button key={id} variant="ghost" className={cn('relative h-11 w-full justify-start gap-3 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:bg-accent/60 hover:text-primary', view === id && 'bg-accent text-primary hover:bg-accent before:absolute before:-left-4 before:h-6 before:w-0.5 before:rounded-r-full before:bg-primary')} aria-label={label} aria-current={view === id ? 'page' : undefined} onClick={() => onViewChange(id)}>
              <Icon className="size-[18px]" aria-hidden="true" />{label}{id === 'solicitudes' && alerts > 0 && <Badge aria-hidden="true" variant="secondary" className="ml-auto rounded-full bg-apricot px-2 text-apricot-foreground">{alerts}</Badge>}
            </Button>
          ))}
        </nav>
        <div className="mt-auto pt-10">
          {provider && <div className="mb-6 px-3">
            <Sparkles className="mb-2.5 size-5 text-primary" aria-hidden="true" />
            <strong className="font-heading text-xs font-bold">Tu trabajo merece verse.</strong>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Describe bien cada servicio para que las personas conozcan lo que ofreces.</p>
          </div>}
          <div className="flex items-center gap-3 border-t border-border px-2 pt-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-apricot text-xs font-bold text-apricot-foreground">{user?.initials || '—'}</span>
            <span className="min-w-0"><strong className="block truncate text-xs font-semibold" title={user?.name}>{user?.name || 'Cargando...'}</strong><small className="mt-1 block text-[11px] text-muted-foreground">{user?.role || 'Mi espacio'}</small></span>
          </div>
          <Button variant="outline" className="mt-4 w-full gap-2 text-xs text-muted-foreground" onClick={onLogout}><LogOut className="size-3.5" aria-hidden="true" />Cerrar sesión</Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm lg:static lg:bg-card">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-12">
            <Brand subtitle={subtitle} className="lg:hidden" />
            <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex"><span>Mi espacio</span><ChevronRight className="size-3 text-muted-foreground/50" aria-hidden="true" /><strong className="font-semibold text-foreground/80">{title}</strong></div>
            <Badge variant="outline" className="hidden gap-2 rounded-full bg-secondary px-3 py-2 text-[10px] font-semibold text-muted-foreground sm:inline-flex"><span className="size-1.5 rounded-full bg-brand-accent" />Servicios del hogar</Badge>
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground lg:hidden" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut className="size-[18px]" aria-hidden="true" /></Button>
          </div>
          <nav className="grid grid-cols-3 gap-2 px-4 pb-3 lg:hidden" aria-label="Navegación principal móvil">
            {navigation.map(({ id, mobileLabel, label, icon: Icon }) => (
              <Button key={id} variant="ghost" className={cn('h-14 flex-col gap-1 rounded-xl px-2 text-[11px] text-muted-foreground sm:h-10 sm:flex-row sm:gap-2 sm:text-xs', view === id && 'bg-accent text-primary hover:bg-accent')} aria-label={label} aria-current={view === id ? 'page' : undefined} onClick={() => onViewChange(id)}><Icon className="size-4" aria-hidden="true" />{mobileLabel}{id === 'solicitudes' && alerts > 0 && <span aria-hidden="true" className="rounded-full bg-apricot px-1.5 text-[10px] text-apricot-foreground">{alerts}</span>}</Button>
            ))}
          </nav>
        </header>
        <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {children}
        </motion.div>
      </div>
    </div>
  )
}

export default AppShell
