import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleAlert, Layers, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Page({ children, className, ...props }) {
  return <main className={cn('mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10', className)} {...props}>{children}</main>
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="mb-8 flex flex-wrap items-start justify-between gap-5 sm:items-center">
    <div>
      <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">{title}<span className="text-brand-accent">.</span></h1>
      {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
}

export function PageFooter() {
  return <footer className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">Hogar+ · Tu espacio de servicios</footer>
}

export function EmptyState({ title, description, children, loading = false, error = false }) {
  const Icon = loading ? LoaderCircle : error ? CircleAlert : Layers
  return <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center" role={error ? 'alert' : loading ? 'status' : undefined}>
    <span className={cn('mb-2 grid size-14 place-items-center rounded-2xl bg-mint text-mint-foreground', error && 'bg-destructive/10 text-destructive')}><Icon className={cn('size-6', loading && 'motion-safe:animate-spin')} aria-hidden="true" /></span>
    <h2 className="text-lg font-bold text-brand">{title}</h2>
    {description && <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {children && <div className="mt-3">{children}</div>}
  </div>
}

export function AnimatedItem({ children, className, ...props }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className={className} {...props}>{children}</motion.div>
}

export function Notice({ message, error = false }) {
  return <AnimatePresence>{message && <motion.div key={message} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} role={error ? 'alert' : 'status'} className={cn('fixed right-4 bottom-5 left-4 z-[100] flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-sm font-medium text-primary-foreground shadow-xl sm:right-6 sm:left-auto sm:max-w-md', error && 'bg-destructive')}>
    {error ? <CircleAlert className="size-4 shrink-0" aria-hidden="true" /> : <Check className="size-4 shrink-0" aria-hidden="true" />}{message}
  </motion.div>}</AnimatePresence>
}
