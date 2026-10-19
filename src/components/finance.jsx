import { money } from '@/lib/money'

// Tabla de conceptos con subtotal, impuesto y total. Se usa en solicitudes, facturación y factura.
export function QuoteBreakdown({ quote, agreement }) {
  if (!quote) return null
  const adjustment = agreement?.adjustment
  const rubros = Object.entries(quote.items.reduce((totals, item) => ({ ...totals, [item.type]: (totals[item.type] || 0) + Math.round(item.lineTotal * 100) }), {}))
    .map(([type, amountCents]) => [type, amountCents / 100])
  return <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full min-w-[520px] text-left text-xs">
      <caption className="sr-only">Desglose de la cotización versión {quote.version}</caption>
      <thead className="bg-secondary/70 text-muted-foreground"><tr>
        <th scope="col" className="px-3 py-2 font-semibold">Concepto</th>
        <th scope="col" className="px-3 py-2 font-semibold">Tipo</th>
        <th scope="col" className="px-3 py-2 text-right font-semibold">Cantidad</th>
        <th scope="col" className="px-3 py-2 text-right font-semibold">Precio unitario</th>
        <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
      </tr></thead>
      <tbody>
        {quote.items.map((item, index) => <tr className="border-t border-border" key={`${item.description}-${index}`}>
          <td className="px-3 py-2 font-medium">{item.description}</td>
          <td className="px-3 py-2 text-muted-foreground">{item.type}</td>
          <td className="px-3 py-2 text-right">{item.quantity}</td>
          <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
          <td className="px-3 py-2 text-right">{money(item.lineTotal)}</td>
        </tr>)}
      </tbody>
      <tfoot className="border-t border-border">
        {rubros.map(([type, amount]) => <tr key={type}><th scope="row" colSpan={4} className="px-3 py-1 text-right text-[11px] font-normal text-muted-foreground">Subtotal · {type}</th><td className="px-3 py-1 text-right text-[11px] text-muted-foreground">{money(amount)}</td></tr>)}
        <tr><th scope="row" colSpan={4} className="px-3 py-1.5 text-right font-normal text-muted-foreground">Subtotal</th><td className="px-3 py-1.5 text-right">{money(quote.subtotal)}</td></tr>
        <tr><th scope="row" colSpan={4} className="px-3 py-1.5 text-right font-normal text-muted-foreground">{quote.taxRate ? `IVA (${quote.taxRate} %)` : 'Impuesto (no aplica)'}</th><td className="px-3 py-1.5 text-right">{money(quote.tax)}</td></tr>
        {adjustment != null && adjustment !== 0 && <tr><th scope="row" colSpan={4} className="px-3 py-1.5 text-right font-normal text-muted-foreground">Ajuste por negociación</th><td className="px-3 py-1.5 text-right">{money(adjustment)}</td></tr>}
        <tr className="bg-accent/60 text-sm"><th scope="row" colSpan={4} className="px-3 py-2 text-right font-bold">{agreement ? 'Total acordado' : 'Total'}</th><td className="px-3 py-2 text-right font-bold text-primary">{money(agreement ? agreement.total : quote.total)}</td></tr>
      </tfoot>
    </table>
  </div>
}

export function StatCard({ icon: Icon, tone, label, value, description }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
    <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
    <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate font-heading text-xl font-extrabold text-brand">{value}</p>{description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}</div>
  </div>
}