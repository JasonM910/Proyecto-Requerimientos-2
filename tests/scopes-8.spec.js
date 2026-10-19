import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { expect, test as base } from '@playwright/test'
import sharp from 'sharp'

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

async function account(playwright, baseURL, identifier, password) {
  const api = await playwright.request.newContext({ baseURL })
  expect((await api.post('/api/auth/login', { data: { identifier, password } })).status()).toBe(200)
  return api
}

test('RF-06 y RF-23: la ubicación exacta y el contacto se entregan solo tras la aceptación', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const provider = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  const other = await account(playwright, baseURL, 'proveedor.demo', 'Proveedor2026!')
  const data = { serviceId: 'demo-4', need: 'Instalar luces en la sala y revisar el interruptor.', urgency: 'Flexible', location: 'Quesada', directions: 'Casa 12, portón azul; tocar el timbre lateral.' }
  try {
    expect((await client.post('/api/client/requests', { data: { ...data, location: 'Casa 12, Quesada' } })).status()).toBe(400)
    expect((await client.post('/api/client/requests', { data: { ...data, need: 'Instalar luces en casa 12, junto al portón azul.' } })).status()).toBe(400)
    expect((await client.post('/api/client/requests', { data: { ...data, need: 'Instalar luces; revisa el enlace ejemplo.cr' } })).status()).toBe(400)
    const created = await client.post('/api/client/requests', { data })
    expect(created.status()).toBe(201)
    const id = (await created.json()).request.id
    const pending = (await (await provider.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(pending.location).toBe('Quesada')
    expect(pending).not.toHaveProperty('directions')
    expect(pending.clientContact).toBeNull()
    expect(JSON.stringify(pending)).not.toContain('portón azul')
    expect((await (await other.get('/api/provider/requests')).json()).requests.some((item) => item.id === id)).toBe(false)

    expect((await provider.patch(`/api/provider/requests/${id}`, { data: { action: 'offer', message: 'Puedo atender el trabajo esta semana.' } })).status()).toBe(200)
    const quoted = (await (await provider.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(quoted).not.toHaveProperty('directions')
    expect(quoted.clientContact).toBeNull()
    expect((await client.patch(`/api/client/requests/${id}`, { data: { action: 'accept' } })).status()).toBe(200)
    const accepted = (await (await provider.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(accepted.directions).toBe(data.directions)
    expect(accepted.clientContact.email).toBe('ana@ejemplo.com')

    const profile = await (await provider.get('/api/profile')).json()
    expect((await provider.put('/api/profile', { data: { ...profile, name: 'Llama al 8888 1234' } })).status()).toBe(400)
    expect((await provider.put('/api/profile', { data: { ...profile, zones: ['www.ejemplo.com'] } })).status()).toBe(400)
    const clientProfile = await (await client.get('/api/client/profile')).json()
    expect((await client.put('/api/client/profile', { data: { ...clientProfile, name: 'Ana 8888 1234' } })).status()).toBe(400)
  } finally { await client.dispose(); await provider.dispose(); await other.dispose() }
})

test('RF-21: solo el equipo revisa la verificación y la insignia refleja su decisión', async ({ playwright, baseURL }) => {
  const provider = await account(playwright, baseURL, 'andres.demo', 'Proveedor2026!')
  const admin = await account(playwright, baseURL, 'admin.demo', 'Admin2026!')
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  try {
    expect((await provider.get('/api/admin/verifications')).status()).toBe(403)
    expect((await provider.patch('/api/provider/verification', { data: { action: 'simulate-approve' } })).status()).toBe(409)
    const list = await (await admin.get('/api/admin/verifications')).json()
    const pending = list.verifications.find((item) => item.providerId === 'proveedor-3')
    expect(pending.status).toBe('En revisión')
    expect(pending.legalId).toBeTruthy()
    expect(pending.documentReference).toBeTruthy()
    expect(pending.verificationEvidence).toHaveLength(1)
    expect((await admin.patch('/api/admin/verifications/proveedor-3', { data: { action: 'approve' } })).status()).toBe(400)
    expect((await admin.patch('/api/admin/verifications/proveedor-3', { data: { action: 'approve', reviewedEvidence: true } })).status()).toBe(200)
    const search = await (await client.get('/api/search')).json()
    expect(search.results.some((item) => item.provider.id === 'proveedor-3' && item.provider.verified)).toBe(true)
    expect(JSON.stringify(search)).not.toContain(pending.legalId)
    expect(JSON.stringify(search)).not.toContain(pending.verificationEvidence[0].dataUrl)

    const profile = await (await provider.get('/api/profile')).json()
    expect((await provider.put('/api/profile', { data: { ...profile, legalId: 'DEMO-NEW-778899', verificationEvidence: [] } })).status()).toBe(200)
    const reset = await (await provider.get('/api/provider/verification')).json()
    expect(reset.status).toBe('Sin verificar')
    expect(reset.checks.find((check) => check.key === 'document').met).toBe(false)
    expect((await provider.patch('/api/provider/verification', { data: { action: 'request' } })).status()).toBe(400)
    const image = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#edf3ec' } }).png().toBuffer()
    const dataUrl = `data:image/png;base64,${image.toString('base64')}`
    const updated = await provider.put('/api/profile', { data: { ...profile, legalId: 'DEMO-NEW-778899', verificationEvidence: [{ name: 'cedula-privada.png', dataUrl }] } })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).verificationEvidence[0].name).toBe('Documento de identidad.png')
    expect((await provider.patch('/api/provider/verification', { data: { action: 'request' } })).status()).toBe(200)
    const reopened = (await (await admin.get('/api/admin/verifications')).json()).verifications.find((item) => item.providerId === 'proveedor-3')
    expect(reopened.verificationEvidence[0].dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(JSON.stringify(await (await client.get('/api/profile/public?providerId=proveedor-3')).json())).not.toContain(reopened.verificationEvidence[0].dataUrl)
    expect((await admin.patch('/api/admin/verifications/proveedor-3', { data: { action: 'reject', note: 'Documento pendiente de aclaración.' } })).status()).toBe(200)
    expect((await (await provider.get('/api/provider/verification')).json()).status).toBe('Rechazado')
    const after = await (await client.get('/api/search')).json()
    expect(after.results.some((item) => item.provider.id === 'proveedor-3' && item.provider.verified)).toBe(false)
  } finally { await provider.dispose(); await admin.dispose(); await client.dispose() }
})

test('RF-21: el proveedor adjunta un documento privado y solicita una nueva revisión', async ({ page, playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  try {
    const image = await sharp({ create: { width: 600, height: 360, channels: 3, background: '#edf3ec' } }).png().toBuffer()
    await page.goto('/')
    await page.getByRole('button', { name: 'Proveedor', exact: true }).click()
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
    await page.getByLabel('Imágenes seleccionadas: Foto del documento de identidad').getByRole('button', { name: 'Quitar imagen 1' }).click()
    await page.locator('#pf-verification-evidence').setInputFiles({ name: 'identidad-privada.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: /identidad-privada.png/ })).toBeVisible()
    await expect(page.getByLabel('Vista pública del perfil')).not.toContainText('identidad-privada.png')
    await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Guardar perfil', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Seguridad y confianza', exact: true }).click()
    await expect(page.getByText('Sin verificar', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Solicitar verificación', exact: true }).click()
    await expect(page.getByText('En revisión', { exact: true }).first()).toBeVisible()
    const publicProfile = await (await client.get('/api/profile/public?providerId=proveedor-demo')).json()
    expect(publicProfile).not.toHaveProperty('verificationEvidence')
    expect(JSON.stringify(publicProfile)).not.toContain('identidad-privada.png')
  } finally { await client.dispose() }
})

test('RF-22: los reportes llegan al equipo y sus decisiones aparecen al autor', async ({ playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  const provider = await account(playwright, baseURL, 'laura.demo', 'Proveedor2026!')
  const admin = await account(playwright, baseURL, 'admin.demo', 'Admin2026!')
  try {
    const created = await client.post('/api/reports', { data: { category: 'Conducta inapropiada', description: 'El proveedor se presentó fuera del horario acordado y fue descortés.', providerId: 'proveedor-2' } })
    expect(created.status()).toBe(201)
    const id = (await created.json()).report.id
    expect((await provider.get('/api/admin/reports')).status()).toBe(403)
    expect((await provider.patch(`/api/admin/reports/${id}`, { data: { action: 'review', note: 'Revisaremos el caso.' } })).status()).toBe(403)
    expect((await client.patch(`/api/reports/${id}`, { data: { action: 'simulate-advance' } })).status()).toBe(404)
    expect((await (await provider.get('/api/reports')).json()).reports.some((item) => item.id === id)).toBe(false)
    const inbox = await (await admin.get('/api/admin/reports')).json()
    expect(inbox.reports.find((item) => item.id === id).reporterName).toBeTruthy()
    expect((await admin.patch(`/api/admin/reports/${id}`, { data: { action: 'resolve', note: 'Caso cerrado.' } })).status()).toBe(409)
    expect((await admin.patch(`/api/admin/reports/${id}`, { data: { action: 'review', note: 'Estamos revisando lo ocurrido.' } })).status()).toBe(200)
    expect((await admin.patch(`/api/admin/reports/${id}`, { data: { action: 'resolve', note: 'Revisamos el caso y registramos la incidencia.' } })).status()).toBe(200)
    const result = (await (await client.get('/api/reports')).json()).reports.find((item) => item.id === id)
    expect(result.status).toBe('Resuelto')
    expect(result.history.map((item) => item.status)).toEqual(['Recibido', 'En revisión', 'Resuelto'])
  } finally { await client.dispose(); await provider.dispose(); await admin.dispose() }
})

test('RF-21 y RF-22: la cuenta del equipo tiene bandeja de reportes y verificaciones', async ({ page, playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'cliente.demo', 'Cliente2026!')
  try {
    expect((await client.post('/api/reports', { data: { category: 'Conducta inapropiada', description: 'Se presentó fuera del horario acordado y fue descortés.', providerId: 'proveedor-2' } })).status()).toBe(201)
  } finally { await client.dispose() }
  await page.goto('/')
  await page.getByRole('button', { name: 'Equipo Hogar+', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reportes recibidos', level: 1 })).toBeVisible()
  const pendingReport = page.locator('[data-slot="card"][aria-label="Reporte: Conducta inapropiada"]')
  await pendingReport.getByLabel('Respuesta del equipo').fill('El equipo está revisando este incidente.')
  await pendingReport.getByRole('button', { name: 'Iniciar revisión' }).click()
  await expect(pendingReport).toContainText('En revisión')
  await pendingReport.getByLabel('Respuesta del equipo').fill('Registramos el resultado de la revisión.')
  await pendingReport.getByRole('button', { name: 'Resolver reporte' }).click()
  await expect(pendingReport).toContainText('Resuelto')
  await page.getByRole('navigation', { name: 'Navegación del equipo' }).getByRole('button', { name: 'Verificar proveedores' }).click()
  await expect(page.getByRole('heading', { name: 'Verificar proveedores', level: 1 })).toBeVisible()
  const pendingProfile = page.locator('[data-slot="card"][aria-label="Verificación: Andrés Solís"]')
  await expect(pendingProfile.getByRole('img', { name: /Documento de identidad/ })).toBeVisible()
  await expect(pendingProfile.getByRole('button', { name: 'Aprobar verificación' })).toBeDisabled()
  await pendingProfile.getByRole('checkbox', { name: /Revisé la foto/ }).check()
  await pendingProfile.getByRole('button', { name: 'Aprobar verificación' }).click()
  await expect(pendingProfile).toContainText('Verificado')
})
