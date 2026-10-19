import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CircleCheck, FileText, HandCoins, Receipt, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AnimatedItem, EmptyState, Page, PageFooter, PageHeader } from '@/components/page'
import { QuoteBreakdown, StatCard } from '@/components/finance'
import { money, paymentState } from '@/lib/money'
import { getBilling, updateClientRequest } from './api.js'

const paymentMethods = ['SINPE Móvil', 'Transferencia', 'Tarjeta (simulado)', 'Efectivo']
const dateFormatter = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
const stateStyles = { Pagado: 'bg-mint text-mint-foreground', 'Pago parcial': 'bg-apricot text-apricot-foreground', 'Pendiente de pago': 'bg-secondary text-secondary-foreground', Cancelado: 'bg-destructive/10 text-destructive' }
const periods = [['all', 'Global'], ['year', 'Este año'], ['month', 'Este mes']]
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

function PaymentHistory({ payments }) {
  if (!payments.length) return <p className="text-xs text-muted-foreground">Aún no hay pagos registrados.</p>
  return <ul className="divide-y divide-border rounded-xl border border-border text-xs" aria-label="Historial de pagos">
    {payments.map((payment) => <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5" key={payment.id}>
      <span><strong>{money(payment.amount)}</strong> · {payment.method}</span>
      <span className="text-muted-foreground">{payment.reference} · <time dateTime={payment.at}>{dateFormatter.format(new Date(payment.at))}</time></span>
    </li>)}
  </ul>
}

function Invoice({ record, isClient, onClose }) {
  const state = paymentState(record)
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Factura {record.invoice.number}</DialogTitle>
        <DialogDescription>Emitida el {dateFormatter.format(new Date(record.invoice.issuedAt))} · Comprobante de demostración, sin validez tributaria.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 rounded-xl bg-secondary/70 p-4 text-xs sm:grid-cols-2">
          <p><span className="block text-muted-foreground">{isClient ? 'Proveedor' : 'Emitida por'}</span><strong>{isClient ? record.providerName : 'Tú'}</strong></p>
          <p><span className="block text-muted-foreground">Cliente</span><strong>{isClient ? 'Tú' : record.clientName}</strong></p>
          <p className="sm:col-span-2"><span className="block text-muted-foreground">Servicio</span><strong>{record.serviceTitle}</strong></p>
        </div>
        <QuoteBreakdown quote={record.quote} agreement={record.agreement} />
        <div><h3 className="mb-2 text-xs font-semibold">Pagos aplicados</h3><PaymentHistory payments={record.payments} /></div>
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/60 p-4 font-semibold">
          <span>Saldo pendiente: {money(record.balance)}</span><Badge variant="secondary" className={`rounded-full px-2.5 py-1 text-[11px] ${stateStyles[state]}`}>{state}</Badge>
        </p>
      </div>
    </DialogContent>
  </Dialog>
}

function PaymentForm({ record, busy, onCancel, onSubmit }) {
  const [method, setMethod] = useState(paymentMethods[0])
  const [amount, setAmount] = useState(String(record.balance))
  return <form className="mt-4 space-y-4 rounded-xl border border-border bg-background p-4" aria-label="Registrar pago" onSubmit={(event) => { event.preventDefault(); onSubmit({ method, amount: Number(amount) }) }}>
    <p className="text-xs leading-relaxed text-muted-foreground">Los pagos son registros de demostración: no se procesa dinero ni se guardan datos de tarjetas.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`method-${record.id}`}>Método de pago</Label><select id={`method-${record.id}`} className={selectClass} value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor={`pay-${record.id}`}>Monto a pagar (₡)</Label><Input id={`pay-${record.id}`} type="number" inputMode="decimal" required min="0.01" max={record.balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></div>
    </div>
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button><Button type="submit" size="sm" disabled={busy}>{busy ? 'Guardando...' : 'Confirmar pago'}</Button></div>
  </form>
}

function Billing({ role, onNotice }) {
  const isClient = role === 'Cliente'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(null)
  const [busy, setBusy] = useState(false)
  const [payError, setPayError] = useState(null)
  const [invoiceId, setInvoiceId] = useState(null)
  const [period, setPeriod] = useState('all')

  const load = useCallback(() => getBilling(period).then((result) => { setData(result); setError('') }).catch((problem) => setError(problem.message)), [period])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') load() }
    refresh()
    const timer = setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [load])

  async function pay(record, payment) {
    setBusy(true)
    setPayError(null)
    try {
      await updateClientRequest(record.id, { action: 'pay', ...payment })
      await load()
      setPaying(null)
      onNotice?.('Pago registrado')
    } catch (problem) {
      setPayError({ id: record.id, message: problem.message })
    } finally { setBusy(false) }
  }

  const invoiceRecord = data?.records.find((record) => record.id === invoiceId)

  return <Page>
    <PageHeader eyebrow="FINANZAS" title="Pagos y facturación" description={isClient ? 'Consulta lo que acordaste, registra tus pagos y revisa tus facturas.' : 'Consulta los acuerdos económicos, los pagos recibidos y las facturas de tus trabajos.'} />
    {error ? <EmptyState error title="No se pudo cargar la información financiera" description={error} />
      : !data ? <EmptyState loading title="Cargando pagos y facturas..." />
        : <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Label htmlFor="billing-period" className="text-xs">Período</Label>
            <select id="billing-period" className={`${selectClass} w-auto`} value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen financiero">
            <StatCard icon={FileText} tone="bg-secondary text-secondary-foreground" label="Total cotizado" value={money(data.totals.quoted)} />
            <StatCard icon={HandCoins} tone="bg-lilac text-lilac-foreground" label="Total acordado" value={money(data.totals.agreed)} description={`${data.records.length} ${data.records.length === 1 ? 'acuerdo' : 'acuerdos'} · ${money(data.totals.closed)} cerrados`} />
            <StatCard icon={CircleCheck} tone="bg-mint text-mint-foreground" label={isClient ? 'Total pagado' : 'Total cobrado'} value={money(data.totals.paid)} />
            <StatCard icon={Wallet} tone="bg-apricot text-apricot-foreground" label={isClient ? 'Saldo pendiente' : 'Por cobrar'} value={money(data.totals.balance)} />
          </section>
          {!data.records.length ? <EmptyState title="Aún no hay acuerdos económicos" description={isClient ? 'Cuando aceptes una cotización, aparecerá aquí con sus pagos.' : 'Cuando un cliente apruebe una cotización, el acuerdo aparecerá aquí.'} />
            : <div className="space-y-4">
              {data.records.map((record) => {
                const state = paymentState(record)
                return <AnimatedItem key={record.id}>
                  <Card className="gap-0 rounded-2xl py-0 shadow-none" aria-label={`Acuerdo: ${record.serviceTitle}`}>
                    <CardContent className="p-5 sm:p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" />Acordado el <time dateTime={record.agreement.at}>{dateFormatter.format(new Date(record.agreement.at || record.createdAt))}</time></span>
                        <span className="flex items-center gap-2"><Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">{record.status}</Badge><Badge variant="secondary" className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stateStyles[state]}`}>{state}</Badge></span>
                      </div>
                      <h2 className="font-heading text-lg leading-snug font-bold text-brand">{record.serviceTitle}</h2>
                      <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{isClient ? 'Proveedor' : 'Cliente'}:</span> {record.counterpart}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{record.agreement.via}</p>
                      <dl className="mt-4 grid gap-2 rounded-xl bg-accent/60 p-4 text-xs sm:grid-cols-3">
                        <div><dt className="text-muted-foreground">Acordado</dt><dd className="text-sm font-bold">{money(record.agreement.total)}</dd></div>
                        <div><dt className="text-muted-foreground">{isClient ? 'Pagado' : 'Cobrado'}</dt><dd className="text-sm font-bold">{money(record.paid)}</dd></div>
                        <div><dt className="text-muted-foreground">Saldo</dt><dd className="text-sm font-bold">{money(record.balance)}</dd></div>
                      </dl>
                      {record.quote && <details className="mt-4 rounded-xl border border-border bg-background p-3 text-xs"><summary className="cursor-pointer font-semibold text-brand">Ver desglose del acuerdo</summary><div className="mt-3"><QuoteBreakdown quote={record.quote} agreement={record.agreement} /></div></details>}
                      <div className="mt-4"><h3 className="mb-2 text-sm font-semibold">Historial de pagos</h3><PaymentHistory payments={record.payments} /></div>
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {isClient && record.balance > 0 && record.status !== 'Cancelado' && <Button size="sm" onClick={() => { setPayError(null); setPaying(record.id) }}><Receipt aria-hidden="true" />Registrar pago</Button>}
                        {record.invoice ? <Button size="sm" variant="outline" onClick={() => setInvoiceId(record.id)}><FileText aria-hidden="true" />Ver factura {record.invoice.number}</Button>
                          : <p className="text-xs text-muted-foreground">La factura se emite cuando el trabajo finaliza o el acuerdo se paga por completo.</p>}
                      </div>
                      {paying === record.id && <PaymentForm record={record} busy={busy} onCancel={() => setPaying(null)} onSubmit={(payment) => pay(record, payment)} />}
                      {payError?.id === record.id && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{payError.message}</p>}
                    </CardContent>
                  </Card>
                </AnimatedItem>
              })}
            </div>}
        </>}
    {invoiceRecord?.invoice && <Invoice record={invoiceRecord} isClient={isClient} onClose={() => setInvoiceId(null)} />}
    <PageFooter />
  </Page>
}

export default Billing
