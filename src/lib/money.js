export const moneyFormatter = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 2 })
export const money = (value) => moneyFormatter.format(value)

const toCents = (value) => Math.round(Number(value) * 100)

// Mismo cálculo que el servidor (céntimos enteros) para que la vista previa coincida con el total guardado.
export function lineTotal(item) {
  const quantity = Number(item.quantity)
  const price = Number(item.unitPrice)
  return Number.isFinite(quantity) && Number.isFinite(price) && quantity > 0 && price > 0 ? Math.round(quantity * toCents(price)) / 100 : 0
}

export function calculateQuote(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(lineTotal(item) * 100), 0)
  const tax = Math.round(subtotal * Number(taxRate) / 100)
  return { subtotal: subtotal / 100, tax: tax / 100, total: (subtotal + tax) / 100 }
}

export function paymentState(record) {
  if (record.status === 'Cancelado') return 'Cancelado'
  if (record.balance === 0) return 'Pagado'
  return record.paid > 0 ? 'Pago parcial' : 'Pendiente de pago'
}