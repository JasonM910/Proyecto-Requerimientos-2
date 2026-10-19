import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { expect, test as base } from '@playwright/test'
import sharp from 'sharp'
import { createSession, sessionIdleMs, sessionUser, verifyCredentials } from '../server/auth.js'

const test = base.extend({
  databaseSnapshot: [async ({ baseURL }, runTest) => {
    const path = process.env.HOGAR_DB_PATH
    if (!baseURL || !path || !basename(dirname(path)).startsWith('hogar-plus-e2e-')) throw new Error('Se requiere la base temporal E2E.')
    const snapshot = await readFile(path, 'utf8')
    try { await runTest(snapshot) } finally { await writeFile(path, snapshot, 'utf8') }
  }, { auto: true }],
})

async function account(playwright, baseURL, role) {
  const api = await playwright.request.newContext({ baseURL })
  const credentials = role === 'Proveedor' ? ['proveedor.demo', 'Proveedor2026!']
    : role === 'Administrador' ? ['admin.demo', 'Admin2026!'] : ['cliente.demo', 'Cliente2026!']
  expect((await api.post('/api/auth/login', { data: { identifier: credentials[0], password: credentials[1] } })).status()).toBe(200)
  return api
}

test('RNF-01 y RNF-02: hashes robustos y sesión invalidada a los 30 minutos sin actividad', async ({ databaseSnapshot }) => {
  const database = JSON.parse(databaseSnapshot)
  expect(database.users.every((user) => /^scrypt:32768:8:3:[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.passwordHash))).toBe(true)
  expect(await verifyCredentials(database, 'cliente.demo', 'Cliente2026!')).toEqual(expect.objectContaining({ id: 'cliente-demo' }))
  expect(await verifyCredentials(database, 'cliente.demo', 'contraseña incorrecta')).toBeNull()

  const user = database.users.find((entry) => entry.id === 'cliente-demo')
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value } }
  const initial = { headers: {}, socket: {} }
  createSession(initial, response, user, 1000)
  const cookie = response.headers['Set-Cookie'].split(';')[0]
  const request = { headers: { cookie }, socket: {} }
  expect(sessionUser(request, response, database, 1000 + sessionIdleMs - 1)?.id).toBe(user.id)
  expect(sessionUser(request, response, database, 1000 + sessionIdleMs)).toBeNull()

  createSession(initial, response, user, 1000)
  const activeCookie = response.headers['Set-Cookie'].split(';')[0]
  const activeRequest = { headers: { cookie: activeCookie, 'x-hogar-activity': '1' }, socket: {} }
  expect(sessionUser(activeRequest, response, database, 1000 + sessionIdleMs - 1)?.id).toBe(user.id)
  delete activeRequest.headers['x-hogar-activity']
  expect(sessionUser(activeRequest, response, database, 1000 + 2 * sessionIdleMs - 2)?.id).toBe(user.id)
  expect(sessionUser(activeRequest, response, database, 1000 + 2 * sessionIdleMs - 1)).toBeNull()
})

test('RNF-03, RNF-04 y RNF-06: API pública sin datos privados y 100 consultas concurrentes', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  try {
    expect((await client.get('/data/db.json')).status()).toBe(404)
    const profile = await (await client.get('/api/profile/public?providerId=proveedor-2')).json()
    expect(profile.providerId).toBe('proveedor-2')
    for (const field of ['email', 'phone', 'address', 'legalId', 'bankAccount']) expect(profile).not.toHaveProperty(field)
    const found = await (await client.get('/api/search?q=tuberías')).json()
    expect(found.results.length).toBeGreaterThan(0)
    expect(JSON.stringify(found)).not.toContain('bankAccount')

    const searchStart = performance.now()
    const searches = await Promise.all(Array.from({ length: 100 }, () => client.get('/api/search?q=instalación')))
    const searchElapsed = performance.now() - searchStart
    expect(searches.every((response) => response.status() === 200)).toBe(true)
    expect(searchElapsed).toBeLessThan(2000)

    const profileStart = performance.now()
    const profiles = await Promise.all(Array.from({ length: 100 }, () => client.get('/api/profile/public?providerId=proveedor-2')))
    const profileElapsed = performance.now() - profileStart
    expect(profiles.every((response) => response.status() === 200)).toBe(true)
    expect(profileElapsed).toBeLessThan(1500)
  } finally { await client.dispose() }
})

test('RNF-07: dos cambios simultáneos no dejan estados divergentes', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  const provider = await account(playwright, baseURL, 'Proveedor')
  try {
    const created = await client.post('/api/client/requests', { data: { serviceId: 'demo-1', need: 'Necesito revisar una fuga de agua en la cocina.', urgency: 'Flexible', location: 'Quesada' } })
    expect(created.status()).toBe(201)
    const id = (await created.json()).request.id
    const results = await Promise.all([
      provider.patch(`/api/provider/requests/${id}`, { data: { action: 'clarify', message: '¿Cuándo empezó la fuga de agua?' } }),
      provider.patch(`/api/provider/requests/${id}`, { data: { action: 'offer', message: 'Puedo revisar la tubería mañana.' } }),
    ])
    expect(results.map((response) => response.status()).sort()).toEqual([200, 409])
    const clientView = (await (await client.get('/api/client/requests')).json()).requests.find((item) => item.id === id)
    const providerView = (await (await provider.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(clientView.status).toBe(providerView.status)
    expect(clientView.history).toEqual(providerView.history)
    expect(clientView.history).toHaveLength(2)
  } finally { await client.dispose(); await provider.dispose() }
})

test('RNF-08: cotizaciones exactas y auditadas', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  const provider = await account(playwright, baseURL, 'Proveedor')
  try {
    const created = await client.post('/api/client/requests', { data: { serviceId: 'demo-1', need: 'Necesito revisar un grifo que pierde agua.', urgency: 'Flexible', location: 'Quesada' } })
    const id = (await created.json()).request.id
    const invalid = await provider.patch(`/api/provider/requests/${id}`, { data: { action: 'quote', message: 'Cotización detallada para el trabajo.', items: [{ description: 'Trabajo inicial', quantity: 1, unitPrice: 0.001 }] } })
    expect(invalid.status()).toBe(400)
    const quoted = await provider.patch(`/api/provider/requests/${id}`, { data: {
      action: 'quote', message: 'Cotización detallada para el trabajo.', taxRate: 13,
      items: [
        { description: 'Trabajo inicial', quantity: 0.3, unitPrice: 0.1 },
        { description: 'Material menor', quantity: 1, unitPrice: 0.05 },
      ],
    } })
    expect(quoted.status()).toBe(200)
    const quote = (await quoted.json()).request.quote
    expect(quote).toEqual(expect.objectContaining({ subtotal: 0.08, tax: 0.01, total: 0.09, by: 'Proveedor', at: expect.any(String) }))
    expect(quote.items.map((item) => item.lineTotal)).toEqual([0.03, 0.05])
    const accepted = await (await client.patch(`/api/client/requests/${id}`, { data: { action: 'accept' } })).json()
    expect(accepted.request.agreement).toEqual(expect.objectContaining({ total: 0.09, at: expect.any(String) }))
    expect(accepted.request.history.at(-1)).toEqual(expect.objectContaining({ actor: 'Cliente', action: 'accept', amount: 0.09, at: expect.any(String) }))
  } finally { await client.dispose(); await provider.dispose() }
})

test('RNF-09: reportes y notas rechazan contenido ejecutable y conservan la trazabilidad', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  const admin = await account(playwright, baseURL, 'Administrador')
  try {
    const baseReport = { category: 'Otra anomalía', description: 'El perfil tiene información que necesito revisar.' }
    expect((await client.post('/api/reports', { data: { ...baseReport, description: '<img src=x onerror=alert(1)>' } })).status()).toBe(400)
    const created = await client.post('/api/reports', { data: baseReport })
    expect(created.status()).toBe(201)
    const id = (await created.json()).report.id
    expect((await admin.patch(`/api/admin/reports/${id}`, { data: { action: 'review', note: '<script>alert(1)</script>' } })).status()).toBe(400)
    const reviewed = await admin.patch(`/api/admin/reports/${id}`, { data: { action: 'review', note: 'Se revisará el perfil con el equipo.' } })
    expect(reviewed.status()).toBe(200)
    const report = (await reviewed.json()).report
    expect(report.history.at(-1)).toEqual(expect.objectContaining({ reviewedBy: 'admin-demo', at: expect.any(String) }))
  } finally { await client.dispose(); await admin.dispose() }
})

test('RNF-10: la foto del perfil se comprime y se publica sin metadatos privados', async ({ playwright, baseURL }) => {
  const provider = await account(playwright, baseURL, 'Proveedor')
  const client = await account(playwright, baseURL, 'Cliente')
  try {
    const original = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#478c6e' } }).jpeg({ quality: 100 }).toBuffer()
    const dataUrl = `data:image/jpeg;base64,${original.toString('base64')}`
    const profile = await (await provider.get('/api/profile')).json()
    const updated = await provider.put('/api/profile', { data: { ...profile, images: [{ name: 'retrato.jpg', dataUrl }] } })
    expect(updated.status()).toBe(200)
    const saved = (await updated.json()).images[0]
    const optimized = Buffer.from(saved.dataUrl.split(',')[1], 'base64')
    const metadata = await sharp(optimized).metadata()
    expect(metadata.width).toBeLessThanOrEqual(512)
    expect(metadata.height).toBeLessThanOrEqual(512)
    expect(optimized.length).toBeLessThan(original.length)
    expect(metadata.exif).toBeUndefined()
    const publicProfile = await (await client.get('/api/profile/public')).json()
    expect(publicProfile.images).toEqual([saved])
    expect(publicProfile).not.toHaveProperty('email')
    const mismatched = await provider.put('/api/profile', { data: { ...profile, images: [{ name: 'falsa.png', dataUrl: dataUrl.replace('image/jpeg', 'image/png') }] } })
    expect(mismatched.status()).toBe(400)
  } finally { await provider.dispose(); await client.dispose() }
})

test('RNF-10: el proveedor cambia su foto desde el perfil y el cliente la ve en el catálogo', async ({ page }) => {
  const image = await sharp({ create: { width: 700, height: 700, channels: 3, background: '#478c6e' } }).png().toBuffer()
  await page.goto('/')
  await page.getByRole('button', { name: 'Proveedor', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  await page.getByLabel('Foto pública del perfil').setInputFiles({ name: 'perfil.png', mimeType: 'image/png', buffer: image })
  await expect(page.getByLabel('Vista pública del perfil').getByRole('img', { name: /Foto de/ })).toBeVisible()
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar perfil', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Foto de Proveedor demo' }).first()).toBeVisible()
})
