import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
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

async function account(playwright, baseURL, role) {
  const api = await playwright.request.newContext({ baseURL })
  const identifier = role === 'Proveedor' ? 'proveedor.demo' : 'cliente.demo'
  const password = role === 'Proveedor' ? 'Proveedor2026!' : 'Cliente2026!'
  expect((await api.post('/api/auth/login', { data: { identifier, password } })).status()).toBe(200)
  return api
}

async function image(page, type, name) {
  const dataUrl = await page.evaluate((mime) => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const context = canvas.getContext('2d')
    context.fillStyle = '#208766'
    context.fillRect(0, 0, 8, 8)
    return canvas.toDataURL(mime)
  }, type)
  return { name, dataUrl }
}

async function login(page, role) {
  await page.goto('/')
  await page.getByRole('button', { name: role, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
}

test('RF-24: las fotos de la publicación se guardan, aparecen en la búsqueda y se pueden quitar al editar', async ({ page, playwright, baseURL }) => {
  const provider = await account(playwright, baseURL, 'Proveedor')
  const client = await account(playwright, baseURL, 'Cliente')
  try {
    await page.goto('/')
    const png = await image(page, 'image/png', 'muestra.png')
    const jpeg = await image(page, 'image/jpeg', 'trabajo.jpg')
    const payload = { title: 'Trabajo con fotos RF24', description: 'Muestra visual de reparación de tuberías.', category: 'Plomería', images: [png, jpeg] }
    const created = await provider.post('/api/services', { data: payload })
    expect(created.status()).toBe(201)
    const id = (await created.json()).id
    const stored = JSON.parse(await readFile(process.env.HOGAR_DB_PATH, 'utf8')).services.find((item) => item.id === id)
    expect(stored.images.map((item) => item.name)).toEqual(['muestra.png', 'trabajo.jpg'])
    expect((await (await client.get('/api/search', { params: { q: 'RF24' } })).json()).results[0].images).toEqual([png, jpeg])

    const edited = await provider.put(`/api/services/${id}`, { data: { ...payload, title: 'Trabajo actualizado RF24' } })
    expect((await edited.json()).images).toHaveLength(2)
    const preserved = await provider.put(`/api/services/${id}`, { data: { title: 'Trabajo actualizado RF24', description: payload.description, category: payload.category } })
    expect((await preserved.json()).images).toHaveLength(2)
    const removed = await provider.put(`/api/services/${id}`, { data: { ...payload, images: [jpeg] } })
    expect((await removed.json()).images).toEqual([jpeg])
  } finally { await provider.dispose(); await client.dispose() }
})

test('RF-24: el cliente adjunta una foto y el proveedor la ve en la solicitud', async ({ page, playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  const provider = await account(playwright, baseURL, 'Proveedor')
  try {
    await page.goto('/')
    const png = await image(page, 'image/png', 'problema.png')
    const request = { serviceId: 'demo-1', need: 'Hay una fuga visible debajo del fregadero.', urgency: 'Flexible', location: 'Quesada', images: [png] }
    const created = await client.post('/api/client/requests', { data: request })
    expect(created.status()).toBe(201)
    const id = (await created.json()).request.id
    const received = (await (await provider.get('/api/provider/requests')).json()).requests.find((item) => item.id === id)
    expect(received.images).toEqual([png])
    expect(received.clientContact).toBeNull()
    expect(JSON.parse(await readFile(process.env.HOGAR_DB_PATH, 'utf8')).requests.find((item) => item.id === id).images).toEqual([png])

    const fake = { name: 'falso.png', dataUrl: `data:image/png;base64,${Buffer.from('No es una imagen').toString('base64')}` }
    expect((await client.post('/api/client/requests', { data: { ...request, images: [fake] } })).status()).toBe(400)
    expect((await client.post('/api/client/requests', { data: { ...request, images: [png, png, png, png] } })).status()).toBe(400)
    expect((await provider.post('/api/services', { data: { title: 'Imagen falsa', description: 'Descripción válida', category: 'Plomería', images: [fake] } })).status()).toBe(400)
    expect((await client.post('/api/services', { data: { title: 'No permitido', description: 'Descripción válida', category: 'Plomería', images: [png] } })).status()).toBe(403)
  } finally { await client.dispose(); await provider.dispose() }
})

test('RF-24: se pueden cargar JPG y PNG desde ambos formularios', async ({ page }) => {
  const captures = resolve('test-results', 'capturas')
  await mkdir(captures, { recursive: true })
  await login(page, 'Proveedor')
  const png = await image(page, 'image/png', 'muestra.png')
  const jpg = await image(page, 'image/jpeg', 'problema.jpg')
  await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click()
  const serviceForm = page.getByRole('dialog', { name: 'Nuevo servicio' })
  await serviceForm.getByLabel('Título del servicio', { exact: false }).fill('Servicio visual RF24')
  await serviceForm.getByRole('combobox', { name: /Categoría/ }).click()
  await page.getByRole('option', { name: 'Plomería', exact: true }).click()
  await serviceForm.getByLabel('Descripción detallada', { exact: false }).fill('Reparación de tuberías con fotos de trabajos anteriores.')
  await serviceForm.getByLabel('Fotos de trabajos anteriores').setInputFiles({ name: png.name, mimeType: 'image/png', buffer: Buffer.from(png.dataUrl.split(',')[1], 'base64') })
  await expect(serviceForm.getByRole('img', { name: /muestra.png/ })).toBeVisible()
  await serviceForm.getByRole('button', { name: 'Publicar servicio' }).click()
  await expect(serviceForm).toBeHidden()
  await expect(page.getByRole('img', { name: 'Muestra de Servicio visual RF24' })).toBeVisible()
  await page.screenshot({ path: join(captures, '11-servicio-con-foto.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()

  await login(page, 'Cliente')
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await page.getByRole('searchbox').fill('Servicio visual RF24')
  await expect(page.getByRole('img', { name: 'Muestra de Servicio visual RF24' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver detalles', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Servicio visual RF24' })
  await expect(detail.getByRole('img', { name: /Foto del servicio 1/ })).toBeVisible()
  await page.screenshot({ path: join(captures, '12-detalle-con-foto.png'), animations: 'disabled' })
  await detail.getByRole('button', { name: 'Solicitar servicio' }).click()
  const requestForm = page.getByRole('dialog', { name: 'Solicitar servicio' })
  await requestForm.getByLabel('¿Qué trabajo necesitas?', { exact: false }).fill('Hay una fuga debajo del fregadero que necesita reparación.')
  await requestForm.getByLabel('Fotos del problema o área del trabajo').setInputFiles({ name: jpg.name, mimeType: 'image/jpeg', buffer: Buffer.from(jpg.dataUrl.split(',')[1], 'base64') })
  await expect(requestForm.getByRole('img', { name: /problema.jpg/ })).toBeVisible()
  await requestForm.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('heading', { name: 'Mis solicitudes', level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: /Foto de la solicitud 1: problema.jpg/ })).toBeVisible()
  await page.screenshot({ path: join(captures, '13-solicitud-con-foto.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await login(page, 'Proveedor')
  await page.getByRole('button', { name: 'Solicitudes recibidas', exact: true }).click()
  await expect(page.getByRole('img', { name: /Foto de la solicitud 1: problema.jpg/ })).toBeVisible()
})
