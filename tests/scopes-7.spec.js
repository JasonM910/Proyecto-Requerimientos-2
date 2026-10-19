import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { expect, test as base } from '@playwright/test'

const test = base.extend({
  databaseSnapshot: [async ({ baseURL }, runTest) => {
    const path = process.env.HOGAR_DB_PATH
    if (!baseURL || !path || !basename(dirname(path)).startsWith('hogar-plus-e2e-')) {
      throw new Error('Estas pruebas requieren la base temporal del servidor E2E.')
    }
    const snapshot = await readFile(path, 'utf8')
    try { await runTest(snapshot) } finally { await writeFile(path, snapshot, 'utf8') }
  }, { auto: true }],
})

async function login(page, account) {
  await page.goto('/')
  await page.getByRole('button', { name: account, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
}

async function logout(page) {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Iniciar sesión/ })).toBeVisible()
}

async function account(playwright, baseURL, identifier, password) {
  const api = await playwright.request.newContext({ baseURL })
  expect((await api.post('/api/auth/login', { data: { identifier, password } })).status()).toBe(200)
  return api
}

const items = [
  { description: 'Instalación de luminarias', type: 'Mano de obra', quantity: 2.5, unitPrice: 8000 },
  { description: 'Cable y cajas', type: 'Materiales', quantity: 1, unitPrice: 12500.5 },
]
const request = { serviceId: 'demo-4', need: 'Instalar cuatro luces en la sala.', urgency: 'Flexible', location: 'Quesada' }

test('RF-17 a RF-19: la cotización se calcula con desglose, se negocia y se aprueba', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const laura = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  const other = await account(playwright, baseURL, 'proveedor.demo', 'Proveedor2026!')
  try {
    const id = (await (await client.post('/api/client/requests', { data: request })).json()).request.id
    const provider = `/api/provider/requests/${id}`
    const own = `/api/client/requests/${id}`
    const quote = (data) => laura.patch(provider, { data: { action: 'quote', message: 'Incluye materiales básicos.', items, taxRate: 13, ...data } })

    for (const data of [
      { items: [] }, { taxRate: 7 }, { message: 'Llámame al 8888 1234' },
      { items: [{ ...items[0], quantity: 0 }] }, { items: [{ ...items[0], unitPrice: 10.123 }] },
      { items: [{ ...items[0], type: 'Magia' }] }, { items: Array(11).fill(items[0]) },
    ]) expect((await quote(data)).status()).toBe(400)
    expect((await client.patch(provider, { data: { action: 'quote', message: 'Cotización lista.', items, taxRate: 0 } })).status()).toBe(403)
    expect((await other.patch(provider, { data: { action: 'quote', message: 'Cotización lista.', items, taxRate: 0 } })).status()).toBe(404)

    const first = await quote({})
    expect(first.status()).toBe(200)
    const q1 = (await first.json()).request.quote
    expect([q1.subtotal, q1.tax, q1.total]).toEqual([32500.5, 4225.07, 36725.57])
    expect(q1.items[0].lineTotal).toBe(20000)

    expect((await client.patch(own, { data: { action: 'pay', amount: 100, method: 'SINPE Móvil' } })).status()).toBe(409)
    for (const data of [
      { amount: 36725.57 }, { amount: 40000 }, { amount: 0 }, { amount: 30000, message: '' },
      { amount: 30000, message: 'Escríbeme a ana@ejemplo.com' },
    ]) expect((await client.patch(own, { data: { action: 'counter', message: 'Podría rebajar un poco, por favor.', ...data } })).status()).toBe(400)
    expect((await laura.patch(own, { data: { action: 'counter', message: 'Rebaja por favor.', amount: 30000 } })).status()).toBe(403)

    const counter = await client.patch(own, { data: { action: 'counter', message: 'Puedo pagar 33000 si se hace esta semana.', amount: 33000 } })
    expect(counter.status()).toBe(200)
    expect((await counter.json()).request.status).toBe('Contraoferta')
    expect((await client.patch(own, { data: { action: 'accept' } })).status()).toBe(409)
    expect((await laura.patch(provider, { data: { action: 'start' } })).status()).toBe(409)

    const revised = await laura.patch(provider, { data: { action: 'revise', message: 'Ajusté la mano de obra.', items: [{ ...items[0], unitPrice: 7500 }, items[1]], taxRate: 13 } })
    expect(revised.status()).toBe(200)
    const afterRevise = (await revised.json()).request
    expect([afterRevise.status, afterRevise.quotes.length, afterRevise.quote.version, afterRevise.quote.total]).toEqual(['Cotizado', 2, 2, 35313.07])

    expect((await client.patch(own, { data: { action: 'counter', message: 'Te propongo 33000 en total.', amount: 33000 } })).status()).toBe(200)
    expect((await laura.patch(provider, { data: { action: 'agree', message: 'De acuerdo.' } })).status()).toBe(200)
    const agreed = (await (await client.get('/api/client/requests')).json()).requests.find((item) => item.id === id)
    expect([agreed.status, agreed.agreement.total, agreed.agreement.adjustment, agreed.balance]).toEqual(['Aceptado', 33000, -2313.07, 33000])
  } finally { await client.dispose(); await laura.dispose(); await other.dispose() }
})

test('RF-20: los pagos validan monto y saldo, la factura se emite al finalizar y el historial es privado', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const laura = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  const demo = await account(playwright, baseURL, 'proveedor.demo', 'Proveedor2026!')
  try {
    const id = (await (await client.post('/api/client/requests', { data: request })).json()).request.id
    const provider = `/api/provider/requests/${id}`
    const own = `/api/client/requests/${id}`
    await laura.patch(provider, { data: { action: 'quote', message: 'Cotización lista.', items: [{ description: 'Instalación completa', type: 'Mano de obra', quantity: 1, unitPrice: 33000 }], taxRate: 0 } })
    expect((await client.patch(own, { data: { action: 'accept' } })).status()).toBe(200)

    for (const data of [
      { amount: 1000, method: 'Bitcoin' }, { amount: 0, method: 'SINPE Móvil' },
      { amount: 33000.01, method: 'SINPE Móvil' }, { amount: 10.005, method: 'SINPE Móvil' },
    ]) expect((await client.patch(own, { data: { action: 'pay', ...data } })).status()).toBe(400)
    expect((await laura.patch(own, { data: { action: 'pay', amount: 1000, method: 'SINPE Móvil' } })).status()).toBe(403)

    const partial = (await (await client.patch(own, { data: { action: 'pay', amount: 13000.25, method: 'SINPE Móvil' } })).json()).request
    expect([partial.paid, partial.balance, partial.payments.length]).toEqual([13000.25, 19999.75, 1])
    const seen = (await (await laura.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(seen.payments).toHaveLength(1)

    expect((await laura.patch(provider, { data: { action: 'finish' } })).status()).toBe(409)
    await laura.patch(provider, { data: { action: 'start' } })
    const finished = (await (await laura.patch(provider, { data: { action: 'finish' } })).json()).request
    expect(finished.invoice.number).toMatch(/^HOG-\d{4}-\d{4}$/)

    const last = (await (await client.patch(own, { data: { action: 'pay', amount: 19999.75, method: 'Transferencia' } })).json()).request
    expect([last.paid, last.balance]).toEqual([33000, 0])
    expect((await client.patch(own, { data: { action: 'pay', amount: 1, method: 'SINPE Móvil' } })).status()).toBe(409)

    const clientBilling = await (await client.get('/api/billing')).json()
    const providerBilling = await (await laura.get('/api/billing')).json()
    const demoBilling = await (await demo.get('/api/billing')).json()
    expect(clientBilling.records.some((item) => item.id === id)).toBe(true)
    expect(clientBilling.records.length).toBeGreaterThanOrEqual(3)
    expect(providerBilling.records.map((item) => item.id)).toEqual([id])
    expect(demoBilling.records.map((item) => item.id).sort()).toEqual(['sol-2', 'sol-3'])
    expect(demoBilling.totals).toEqual({ agreed: 65050, paid: 40500, balance: 24550 })
    expect(JSON.stringify(clientBilling)).not.toContain('bankAccount')
    expect((await (await playwright.request.newContext({ baseURL })).get('/api/billing')).status()).toBe(401)

    const withoutAmount = (await (await client.post('/api/client/requests', { data: request })).json()).request.id
    await laura.patch(`/api/provider/requests/${withoutAmount}`, { data: { action: 'offer', message: 'Puedo atender el lunes.' } })
    const accepted = (await (await client.patch(`/api/client/requests/${withoutAmount}`, { data: { action: 'accept' } })).json()).request
    expect([accepted.agreement, accepted.balance]).toEqual([null, null])
    expect((await client.patch(`/api/client/requests/${withoutAmount}`, { data: { action: 'pay', amount: 10, method: 'Efectivo' } })).status()).toBe(409)
  } finally { await client.dispose(); await laura.dispose(); await demo.dispose() }
})

test('RF-17 a RF-20: el cliente negocia, el proveedor acepta, el cliente paga y consulta la factura', async ({ page, playwright, baseURL }) => {
  const clientApi = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const providerApi = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  try {
    const id = (await (await clientApi.post('/api/client/requests', { data: request })).json()).request.id
    await providerApi.patch(`/api/provider/requests/${id}`, { data: { action: 'quote', message: 'Incluye materiales básicos.', items, taxRate: 13 } })

    await login(page, 'Cliente')
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(card).toContainText('Cotizado')
    await card.getByText('Ver desglose de la cotización').click()
    await expect(card.getByRole('table', { name: /Desglose de la cotización/ })).toContainText('Instalación de luminarias')
    await card.getByRole('button', { name: 'Hacer contraoferta' }).click()
    await card.getByLabel('Mensaje para el proveedor').fill('Puedo pagar 33000 si se hace esta semana.')
    await card.getByLabel('Monto que propones (₡)').fill('33000')
    await card.getByRole('button', { name: 'Enviar contraoferta' }).click()
    await expect(card).toContainText('Esperando la respuesta del proveedor')

    await logout(page)
    await login(page, 'Laura Jiménez')
    await page.getByRole('navigation', { name: 'Navegación del proveedor' }).getByRole('button', { name: 'Solicitudes recibidas' }).click()
    const providerCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(providerCard).toContainText('Contraoferta del cliente')
    await providerCard.getByRole('button', { name: 'Aceptar contraoferta' }).click()
    await expect(providerCard).toContainText('Aceptado')
    await providerCard.getByRole('button', { name: 'Iniciar trabajo' }).click()
    await providerCard.getByRole('button', { name: 'Marcar finalizado' }).click()
    await expect(providerCard).toContainText('Finalizado')

    await logout(page)
    await login(page, 'Cliente')
    await page.getByRole('navigation', { name: 'Navegación del cliente' }).getByRole('button', { name: 'Pagos y facturación' }).click()
    await expect(page.getByRole('heading', { name: 'Pagos y facturación', level: 1 })).toBeVisible()
    const agreement = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(agreement).toContainText('Pendiente de pago')
    await agreement.getByRole('button', { name: 'Registrar pago' }).click()
    await agreement.getByLabel('Monto a pagar (₡)').fill('10000')
    await agreement.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(agreement).toContainText('Pago parcial')
    await agreement.getByRole('button', { name: 'Registrar pago' }).click()
    await agreement.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(agreement).toContainText('Pagado')
    await expect(agreement.getByRole('list', { name: 'Historial de pagos' }).locator('li')).toHaveCount(2)
    await agreement.getByRole('button', { name: /^Ver factura HOG-/ }).click()
    const invoice = page.getByRole('dialog', { name: /^Factura HOG-/ })
    await expect(invoice).toContainText('Pagado')
    await expect(invoice).toContainText('Ajuste por negociación')
    await page.keyboard.press('Escape')

    await logout(page)
    await login(page, 'Laura Jiménez')
    await page.getByRole('navigation', { name: 'Navegación del proveedor' }).getByRole('button', { name: 'Pagos y facturación' }).click()
    const received = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(received).toContainText('Pagado')
    await expect(received.getByRole('button', { name: 'Registrar pago' })).toHaveCount(0)
  } finally { await clientApi.dispose(); await providerApi.dispose() }
})