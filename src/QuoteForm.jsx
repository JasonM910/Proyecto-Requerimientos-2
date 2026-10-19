import { useState } from 'react'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { calculateQuote, lineTotal, money } from '@/lib/money'
import { FieldError, ValidatedForm } from '@/components/InlineValidation'

const itemTypes = ['Mano de obra', 'Materiales', 'Transporte', 'Otro']
const blankItem = () => ({ description: '', type: 'Mano de obra', quantity: '1', unitPrice: '' })
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

// Calculadora de tarifas: cantidad × precio por concepto, con impuesto opcional y total en vivo.
function QuoteForm({ id, previous, busy, submitLabel = 'Enviar al cliente', onCancel, onSubmit }) {
  const [message, setMessage] = useState('')
  const [taxRate, setTaxRate] = useState(previous?.taxRate ?? 0)
  const [items, setItems] = useState(previous
    ? previous.items.map((item) => ({ description: item.description, type: item.type, quantity: String(item.quantity), unitPrice: String(item.unitPrice) }))
    : [blankItem()])
  const totals = calculateQuote(items, taxRate)

  const change = (index, field, value) => setItems((current) => current.map((item, position) => position === index ? { ...item, [field]: value } : item))

  function submit(event) {
    event.preventDefault()
    onSubmit({
      message: message.trim(),
      taxRate: Number(taxRate),
      items: items.map((item) => ({ description: item.description.trim(), type: item.type, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
    })
  }

  return <ValidatedForm className="mt-4 space-y-5 rounded-xl border border-border bg-background p-4" onSubmit={submit} aria-label="Cotización detallada">
    <p className="flex items-center gap-2 text-sm font-semibold text-brand"><Calculator className="size-4 text-primary" aria-hidden="true" />{previous ? `Nueva versión de la cotización (v${previous.version + 1})` : 'Cotización detallada'}</p>
    <div className="space-y-3">
      {items.map((item, index) => <fieldset className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_9rem] lg:grid-cols-[minmax(0,2fr)_9rem_6rem_9rem_auto]" key={index}>
        <legend className="px-1 text-[11px] font-semibold text-muted-foreground">Concepto {index + 1}</legend>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1"><Label htmlFor={`${id}-d-${index}`} className="text-xs">Descripción del concepto {index + 1}</Label><Input id={`${id}-d-${index}`} required minLength={3} maxLength={80} value={item.description} onChange={(event) => change(index, 'description', event.target.value)} disabled={busy} placeholder="Ej. Instalación de luminarias" /><FieldError id={`${id}-d-${index}`} /></div>
        <div className="space-y-1.5"><Label htmlFor={`${id}-t-${index}`} className="text-xs">Tipo {index + 1}</Label><select id={`${id}-t-${index}`} className={selectClass} value={item.type} onChange={(event) => change(index, 'type', event.target.value)} disabled={busy}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor={`${id}-q-${index}`} className="text-xs">Cantidad {index + 1}</Label><Input id={`${id}-q-${index}`} type="number" inputMode="decimal" required min="0.01" max="1000" step="0.01" value={item.quantity} onChange={(event) => change(index, 'quantity', event.target.value)} disabled={busy} /><FieldError id={`${id}-q-${index}`} /></div>
        <div className="space-y-1.5"><Label htmlFor={`${id}-p-${index}`} className="text-xs">Precio unitario {index + 1} (₡)</Label><Input id={`${id}-p-${index}`} type="number" inputMode="decimal" required min="0.01" max="100000000" step="0.01" value={item.unitPrice} onChange={(event) => change(index, 'unitPrice', event.target.value)} disabled={busy} /><FieldError id={`${id}-p-${index}`} /></div>
        <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1">
          <p className="pb-2 text-xs text-muted-foreground">Total: <strong className="text-foreground">{money(lineTotal(item))}</strong></p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar concepto ${index + 1}`} title="Quitar concepto" disabled={busy || items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))}><Trash2 aria-hidden="true" /></Button>
        </div>
      </fieldset>)}
      <Button type="button" size="sm" variant="outline" disabled={busy || items.length >= 10} onClick={() => setItems((current) => [...current, blankItem()])}><Plus aria-hidden="true" />Agregar concepto</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${id}-tax`} className="text-xs">Impuesto</Label><select id={`${id}-tax`} className={selectClass} value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} disabled={busy}><option value={0}>Sin impuesto</option><option value={13}>IVA 13 %</option></select></div>
      <dl className="space-y-1 rounded-lg bg-accent/60 p-3 text-xs" aria-label="Totales de la cotización">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Impuesto</dt><dd>{money(totals.tax)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-primary/15 pt-1 text-sm font-bold text-primary"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
      </dl>
    </div>
    <div className="space-y-2"><Label htmlFor={`${id}-m`}>Mensaje para el cliente</Label><Textarea id={`${id}-m`} minLength={5} maxLength={600} rows={3} required value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy} placeholder="Explica qué incluye la propuesta. No agregues datos de contacto." /><FieldError id={`${id}-m`} /></div>
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button><Button type="submit" size="sm" disabled={busy}>{busy ? 'Guardando...' : submitLabel}</Button></div>
  </ValidatedForm>
}

export default QuoteForm
