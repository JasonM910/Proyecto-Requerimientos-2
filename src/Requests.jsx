import { useEffect, useState } from 'react'
import { CalendarDays, LockKeyhole, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { getClientRequests, getProviderRequests } from './api.js'

const statusStyles = {
  Pendiente: 'bg-apricot text-apricot-foreground',
  Cotizado: 'bg-lilac text-lilac-foreground',
  Aceptado: 'bg-mint text-mint-foreground',
  'En proceso': 'bg-blue-50 text-blue-700',
  Finalizado: 'bg-secondary text-secondary-foreground',
}

const dateFormatter = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })

function Requests({ role }) {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const isClient = role === 'Cliente'

  useEffect(() => {
    let active = true
    const load = isClient ? getClientRequests : getProviderRequests
    load().then((data) => { if (active) { setRequests(data.requests); setError('') } })
      .catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [isClient])

  return <Page>
    <PageHeader eyebrow="HISTORIAL DE SERVICIOS" title={isClient ? 'Mis solicitudes' : 'Solicitudes recibidas'} description={isClient ? 'Consulta tus solicitudes y su estado actual.' : 'Consulta las solicitudes relacionadas con tus servicios.'} />
    {error ? <EmptyState error title="No se pudo cargar el historial" description={error} />
      : !requests ? <EmptyState loading title="Cargando solicitudes..." />
        : !requests.length ? <EmptyState title="Aún no hay solicitudes" description="Cuando haya actividad, aparecerá aquí." />
          : <div className="space-y-4">
            {requests.map((item) => <AnimatedItem key={item.id}>
              <Card className="gap-0 rounded-2xl py-0 shadow-none">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time></span>
                    <Badge variant="secondary" className={`gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[item.status] || statusStyles.Pendiente}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{item.status}</Badge>
                  </div>
                  <h2 className="font-heading text-lg leading-snug font-bold text-brand">{item.serviceTitle}</h2>
                  <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{isClient ? 'Proveedor' : 'Cliente'}:</span> {isClient ? item.providerName : item.clientName}</p>
                  {item.need && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground"><span className="font-medium text-foreground">Necesidad:</span> {item.need}</p>}
                  {!isClient && (item.clientContact
                    ? <div className="mt-5 rounded-xl border border-primary/10 bg-accent/60 p-4">
                      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" />Datos de contacto disponibles</p>
                      <div className="grid gap-2.5 text-xs leading-relaxed text-foreground sm:grid-cols-2">
                        <p className="flex items-start gap-2"><Phone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span>Teléfono: {item.clientContact.phone || 'Sin registrar'}</span></p>
                        <p className="flex min-w-0 items-start gap-2"><Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 break-words">Correo: {item.clientContact.email || 'Sin registrar'}</span></p>
                        <p className="flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span>Dirección: {item.clientContact.address || 'Sin registrar'}</span></p>
                      </div>
                    </div>
                    : <div className="mt-5 flex items-start gap-3 rounded-xl bg-secondary/70 p-4">
                      <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div><p className="text-xs font-semibold">Datos de contacto protegidos</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Se mostrarán cuando la solicitud esté aceptada.</p></div>
                    </div>)}
                </CardContent>
              </Card>
            </AnimatedItem>)}
          </div>}
    <PageFooter />
  </Page>
}

export default Requests
