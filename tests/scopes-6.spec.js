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

test('RF-14 a RF-16: el cliente solicita, el proveedor aclara y cotiza, el cliente acepta y se termina el trabajo', async ({ page, playwright, baseURL }) => {
  const clientApi = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const providerApi = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  let requestId
  try {
    await login(page, 'Cliente')
    await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
    await page.getByRole('searchbox').fill('eléctricas residenciales')
    await expect(page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ver detalles', exact: true }).click()
    await page.getByRole('dialog', { name: 'Instalaciones eléctricas residenciales' }).getByRole('button', { name: 'Solicitar servicio' }).click()
    const form = page.getByRole('dialog', { name: 'Solicitar servicio' })
    await form.getByLabel('¿Qué trabajo necesitas?', { exact: false }).fill('Instalar luces nuevas en la sala y revisar el interruptor.')
    await form.getByRole('combobox', { name: /Urgencia/ }).click()
    await page.getByRole('option', { name: 'Urgente' }).click()
    await form.getByLabel('Zona general', { exact: false }).fill('Quesada')
    await form.getByRole('button', { name: 'Enviar solicitud' }).click()
    await expect(page.getByRole('heading', { name: 'Mis solicitudes', level: 1 })).toBeVisible()
    const clientCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(clientCard).toContainText('Pendiente')
    await expect(clientCard).toContainText('Urgente')
    const clientRequests = await (await clientApi.get('/api/client/requests')).json()
    requestId = clientRequests.requests.find((item) => item.serviceId === 'demo-4').id
    expect(requestId).toBeTruthy()

    await logout(page)
    await login(page, 'Laura Jiménez')
    const providerNav = page.getByRole('navigation', { name: 'Navegación del proveedor' }).getByRole('button', { name: 'Solicitudes recibidas' })
    await expect(providerNav).toContainText('1')
    await providerNav.click()
    const providerCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Instalaciones eléctricas residenciales', exact: true }) })
    await expect(providerCard).toContainText('Instalar luces nuevas')
    await expect(providerCard).toContainText('Datos de contacto protegidos')
    await expect(providerCard).not.toContainText('ana@ejemplo.com')
    await providerCard.getByRole('button', { name: 'Pedir aclaración' }).click()
    await providerCard.getByLabel('¿Qué necesitas aclarar?').fill('¿Cuántas luces quieres instalar?')
    await providerCard.getByRole('button', { name: 'Enviar al cliente' }).click()
    await expect(providerCard).toContainText('Aclaración solicitada')

    await logout(page)
    await login(page, 'Cliente')
    await clientCard.getByRole('button', { name: 'Responder aclaración' }).click()
    await clientCard.getByLabel('Tu respuesta').fill('Quiero instalar cuatro luces en la sala.')
    await clientCard.getByRole('button', { name: 'Enviar respuesta' }).click()
    await expect(clientCard).toContainText('Pendiente')

    await logout(page)
    await login(page, 'Laura Jiménez')
    await providerNav.click()
    await expect(providerCard).toContainText('Quiero instalar cuatro luces')
    await providerCard.getByRole('button', { name: 'Enviar cotización' }).click()
    await providerCard.getByLabel('Mensaje para el cliente').fill('Puedo instalar las cuatro luces el próximo lunes.')
    await providerCard.getByLabel('Descripción del concepto 1').fill('Instalación de cuatro luces')
    await providerCard.getByLabel('Precio unitario 1 (₡)').fill('45000.50')
    await providerCard.getByRole('button', { name: 'Enviar al cliente' }).click()
    await expect(providerCard).toContainText('Cotizado')
    await expect(providerCard).toContainText('Datos de contacto protegidos')
    const beforeAccept = await (await providerApi.get('/api/provider/requests')).json()
    expect(beforeAccept.requests.find((item) => item.id === requestId).clientContact).toBeNull()

    await logout(page)
    await login(page, 'Cliente')
    await expect(clientCard).toContainText('45 000,50')
    await clientCard.getByRole('button', { name: 'Aceptar propuesta' }).click()
    await expect(clientCard).toContainText('Aceptado')
    const afterAccept = await (await providerApi.get('/api/provider/requests')).json()
    expect(afterAccept.requests.find((item) => item.id === requestId).clientContact.email).toBe('ana@ejemplo.com')

    await logout(page)
    await login(page, 'Laura Jiménez')
    await providerNav.click()
    await expect(providerCard).toContainText('Datos de contacto disponibles')
    await providerCard.getByRole('button', { name: 'Iniciar trabajo' }).click()
    await expect(providerCard).toContainText('En proceso')
    await providerCard.getByRole('button', { name: 'Marcar finalizado' }).click()
    await expect(providerCard).toContainText('Finalizado')
    const saved = JSON.parse(await readFile(process.env.HOGAR_DB_PATH, 'utf8')).requests.find((item) => item.id === requestId)
    expect(saved.status).toBe('Finalizado')
    expect(saved.history.map((event) => event.status)).toEqual([
      'Pendiente', 'Aclaración solicitada', 'Pendiente', 'Cotizado', 'Aceptado', 'En proceso', 'Finalizado',
    ])
    await logout(page)
    await login(page, 'Cliente')
    await expect(clientCard).toContainText('Finalizado')
    await expect(clientCard.getByRole('region', { name: 'Seguimiento de la solicitud' }).locator('li')).toHaveCount(7)
  } finally { await clientApi.dispose(); await providerApi.dispose() }
})

test('RF-14 a RF-16: valida mensajes, permisos, propiedad y transiciones de estado', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const laura = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  const other = await account(playwright, baseURL, 'proveedor.demo', 'Proveedor2026!')
  const valid = { serviceId: 'demo-4', need: 'Revisar luces de la cocina.', urgency: 'Flexible', location: 'Quesada' }
  try {
    for (const data of [
      { ...valid, serviceId: 'servicio-inexistente' },
      { ...valid, need: 'corto' },
      { ...valid, urgency: 'Inmediato' },
      { ...valid, location: 'Quesada, teléfono 8888 1234' },
      { ...valid, need: 'Escríbeme a ana@ejemplo.com' },
    ]) expect((await client.post('/api/client/requests', { data })).status()).toBe(data.serviceId === 'servicio-inexistente' ? 404 : 400)
    expect((await laura.post('/api/client/requests', { data: valid })).status()).toBe(403)
    const created = await client.post('/api/client/requests', { data: valid })
    expect(created.status()).toBe(201)
    const id = (await created.json()).request.id
    const path = `/api/provider/requests/${id}`
    const clientPath = `/api/client/requests/${id}`
    expect((await client.patch(path, { data: { action: 'quote', amount: 10000, message: 'Trabajo posible.' } })).status()).toBe(403)
    expect((await other.patch(path, { data: { action: 'quote', amount: 10000, message: 'Trabajo posible.' } })).status()).toBe(404)
    expect((await laura.patch(clientPath, { data: { action: 'accept' } })).status()).toBe(403)
    expect((await client.patch(clientPath, { data: { action: 'accept' } })).status()).toBe(409)
    expect((await laura.patch(path, { data: { action: 'start' } })).status()).toBe(409)
    expect((await laura.patch(path, { data: { action: 'quote', amount: -3, message: 'Trabajo posible.' } })).status()).toBe(400)
    expect((await laura.patch(path, { data: { action: 'quote', amount: 10000, message: 'Llámame al 8888 1234' } })).status()).toBe(400)
    expect((await laura.patch(path, { data: { action: 'offer', message: 'Puedo atender el trabajo el lunes.' } })).status()).toBe(200)
    expect((await laura.patch(path, { data: { action: 'offer', message: 'Otra propuesta.' } })).status()).toBe(409)
    const before = await (await laura.get('/api/provider/requests')).json()
    expect(before.requests.find((item) => item.id === id).clientContact).toBeNull()
    expect((await client.patch(clientPath, { data: { action: 'accept' } })).status()).toBe(200)
    expect((await laura.patch(path, { data: { action: 'finish' } })).status()).toBe(409)
    expect((await laura.patch(path, { data: { action: 'start' } })).status()).toBe(200)
    expect((await laura.patch(path, { data: { action: 'finish' } })).status()).toBe(200)
    expect((await laura.patch(path, { data: { action: 'start' } })).status()).toBe(409)
    const after = await (await laura.get('/api/provider/requests')).json()
    expect(after.requests.find((item) => item.id === id).clientContact.email).toBe('ana@ejemplo.com')
  } finally { await client.dispose(); await laura.dispose(); await other.dispose() }
})
