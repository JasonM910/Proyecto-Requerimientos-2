import { useEffect, useState } from 'react'
import { CalendarDays, LockKeyhole, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { getClientRequests, getProviderRequests, updateClientRequest, updateProviderRequest } from './api.js'

const statusStyles = {
  Pendiente: 'bg-apricot text-apricot-foreground',
  'Aclaración solicitada': 'bg-blue-50 text-blue-700',
  'Propuesta recibida': 'bg-lilac text-lilac-foreground',
  Cotizado: 'bg-lilac text-lilac-foreground',
  Aceptado: 'bg-mint text-mint-foreground',
  'En proceso': 'bg-blue-50 text-blue-700',
  Finalizado: 'bg-secondary text-secondary-foreground',
}

const dateFormatter = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
const momentFormatter = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const moneyFormatter = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 2 })

function Timeline({ history }) {
  return <section className="mt-5 border-t border-border pt-4" aria-label="Seguimiento de la solicitud">
    <h3 className="mb-3 text-sm font-semibold">Seguimiento</h3>
    <ol className="space-y-3 border-l-2 border-primary/15 pl-4">
      {history.map((event, index) => <li className="relative text-xs leading-relaxed" key={`${event.at}-${index}`}>
        <span className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
        <div className="flex flex-wrap items-baseline gap-x-2"><strong>{event.status} · {event.actor}</strong><time dateTime={event.at} className="text-muted-foreground">{momentFormatter.format(new Date(event.at))}</time></div>
        {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{event.actor}: {event.note}</p>}
        {event.amount != null && <p className="mt-1 text-muted-foreground">Estimación: {moneyFormatter.format(event.amount)}</p>}
      </li>)}
    </ol>
  </section>
}

function Requests({ role, refreshKey = 0, onUpdated }) {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const isClient = role === 'Cliente'

  useEffect(() => {
    let active = true
    const load = isClient ? getClientRequests : getProviderRequests
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      load().then((data) => { if (active) { setRequests(data.requests); setError('') } })
        .catch((problem) => { if (active) setError(problem.message) })
    }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [isClient, refreshKey])

  async function act(item, action, message = '', amount = '') {
    setSavingId(item.id)
    setActionError(null)
    try {
      const update = isClient ? updateClientRequest : updateProviderRequest
      const payload = { action, ...(message ? { message: message.trim() } : {}), ...(action === 'quote' ? { amount: Number(amount) } : {}) }
      const result = await update(item.id, payload)
      setRequests((current) => current.map((existing) => existing.id === item.id ? result.request : existing))
      setDraft(null)
      onUpdated?.(result.request)
    } catch (problem) {
      setActionError({ id: item.id, message: problem.message })
    } finally {
      setSavingId(null)
    }
  }

  function startDraft(item, mode) {
    setActionError(null)
    setDraft({ id: item.id, mode, message: '', amount: '' })
  }

  const pending = !isClient ? requests?.filter((item) => item.status === 'Pendiente').length : 0

  return <Page>
    <PageHeader eyebrow="SEGUIMIENTO DE SERVICIOS" title={isClient ? 'Mis solicitudes' : 'Solicitudes recibidas'} description={isClient ? 'Consulta las respuestas y el estado de cada trabajo.' : pending ? `Tienes ${pending} ${pending === 1 ? 'solicitud por responder' : 'solicitudes por responder'}.` : 'Revisa las solicitudes y responde a tus clientes.'} />
    {error ? <EmptyState error title="No se pudo cargar el historial" description={error} />
      : !requests ? <EmptyState loading title="Cargando solicitudes..." />
        : !requests.length ? <EmptyState title="Aún no hay solicitudes" description={isClient ? 'Busca un servicio para enviar tu primera solicitud.' : 'Las nuevas solicitudes aparecerán aquí.'} />
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
                  {item.need && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line break-words text-muted-foreground"><span className="font-medium text-foreground">Necesidad:</span> {item.need}</p>}
                  {(item.urgency || item.location) && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">{item.urgency && <p><span className="font-medium text-foreground">Urgencia:</span> {item.urgency}</p>}{item.location && <p><span className="font-medium text-foreground">Zona general:</span> {item.location}</p>}</div>}
                  {item.estimate != null && <p className="mt-3 text-sm font-semibold text-primary">Monto estimado: {moneyFormatter.format(item.estimate)}</p>}
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
                      <div><p className="text-xs font-semibold">Datos de contacto protegidos</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Se mostrarán cuando el cliente acepte la propuesta.</p></div>
                    </div>)}
                  <Timeline history={item.history || [{ status: item.status, at: item.createdAt, actor: 'Sistema' }]} />
                  <div className="mt-5 flex flex-wrap gap-2">
                    {!isClient && item.status === 'Pendiente' && <>
                      <Button size="sm" variant="outline" onClick={() => startDraft(item, 'clarify')}>Pedir aclaración</Button>
                      <Button size="sm" variant="outline" onClick={() => startDraft(item, 'offer')}>Aceptar preliminarmente</Button>
                      <Button size="sm" onClick={() => startDraft(item, 'quote')}>Enviar cotización</Button>
                    </>}
                    {isClient && item.status === 'Aclaración solicitada' && <Button size="sm" onClick={() => startDraft(item, 'reply')}>Responder aclaración</Button>}
                    {isClient && ['Cotizado', 'Propuesta recibida'].includes(item.status) && <Button size="sm" disabled={savingId === item.id} onClick={() => act(item, 'accept')}>Aceptar propuesta</Button>}
                    {!isClient && item.status === 'Aceptado' && <Button size="sm" disabled={savingId === item.id} onClick={() => act(item, 'start')}>Iniciar trabajo</Button>}
                    {!isClient && item.status === 'En proceso' && <Button size="sm" disabled={savingId === item.id} onClick={() => act(item, 'finish')}>Marcar finalizado</Button>}
                  </div>
                  {draft?.id === item.id && <form className="mt-4 space-y-4 rounded-xl border border-border bg-background p-4" onSubmit={(event) => { event.preventDefault(); act(item, draft.mode, draft.message, draft.amount) }}>
                    <div className="space-y-2">
                      <Label htmlFor={`reply-${item.id}`}>{draft.mode === 'clarify' ? '¿Qué necesitas aclarar?' : draft.mode === 'reply' ? 'Tu respuesta' : 'Mensaje para el cliente'}</Label>
                      <Textarea id={`reply-${item.id}`} minLength={5} maxLength={600} rows={3} required value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} disabled={savingId === item.id} placeholder="Escribe un mensaje claro sin datos de contacto." />
                    </div>
                    {draft.mode === 'quote' && <div className="space-y-2"><Label htmlFor={`amount-${item.id}`}>Monto estimado (₡)</Label><Input id={`amount-${item.id}`} type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} disabled={savingId === item.id} /></div>}
                    <div className="flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)} disabled={savingId === item.id}>Cancelar</Button><Button type="submit" size="sm" disabled={savingId === item.id}>{savingId === item.id ? 'Guardando...' : draft.mode === 'reply' ? 'Enviar respuesta' : 'Enviar al cliente'}</Button></div>
                  </form>}
                  {actionError?.id === item.id && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{actionError.message}</p>}
                </CardContent>
              </Card>
            </AnimatedItem>)}
          </div>}
    <PageFooter />
  </Page>
}

export default Requests
