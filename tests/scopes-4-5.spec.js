import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { expect, test as base } from '@playwright/test'

// Cada prueba recupera su copia temporal, incluso si una comprobación falla.
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
  const response = await api.post('/api/auth/login', { data: {
    identifier: role === 'Proveedor' ? 'proveedor.demo' : 'cliente.demo',
    password: role === 'Proveedor' ? 'Proveedor2026!' : 'Cliente2026!',
  } })
  expect(response.ok()).toBeTruthy()
  return api
}

async function login(page, role) {
  await page.goto('/')
  await page.getByRole('button', { name: role, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
}

test('RF-09 y RF-10: publicar, recategorizar y eliminar actualiza el catálogo del cliente', async ({ page, playwright, baseURL }) => {
  const client = await account(playwright, baseURL, 'Cliente')
  try {
    await login(page, 'Proveedor')
    await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Título del servicio', { exact: false }).fill('Publicación de alcance cuatro')
    await form.getByRole('combobox', { name: /Categoría/ }).click()
    await expect(page.getByText('Reparaciones e instalaciones', { exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Plomería', exact: true }).click()
    await form.getByLabel('Descripción detallada', { exact: false }).fill('Servicio de revisión de tuberías con diagnóstico incluido.')
    await form.getByRole('button', { name: 'Publicar servicio', exact: true }).click()
    await expect(form).toBeHidden()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Publicación de alcance cuatro', exact: true })).toBeVisible()
    const published = await (await client.get('/api/search', { params: { q: 'Publicación de alcance cuatro' } })).json()
    expect(published.total).toBe(1)
    const id = published.results[0].id

    await page.getByRole('button', { name: /^Plomería/ }).click()
    await page.getByRole('button', { name: 'Editar Publicación de alcance cuatro', exact: true }).click()
    await form.getByLabel('Título del servicio', { exact: false }).fill('Publicación actualizada de alcance cuatro')
    await form.getByLabel('Descripción detallada', { exact: false }).fill('Diagnóstico e instalación de tomacorrientes para el hogar.')
    await form.getByRole('combobox', { name: /Categoría/ }).click()
    await page.getByRole('option', { name: 'Electricidad', exact: true }).click()
    await form.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name: /^Electricidad/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: 'Publicación actualizada de alcance cuatro', exact: true })).toBeVisible()
    const updated = await (await client.get('/api/search', { params: { category: 'Electricidad', q: 'tomacorrientes' } })).json()
    expect(updated.results).toEqual(expect.arrayContaining([expect.objectContaining({ id, category: 'Electricidad', title: 'Publicación actualizada de alcance cuatro' })]))
    const oldCategory = await (await client.get('/api/search', { params: { category: 'Plomería' } })).json()
    expect(oldCategory.results.some((item) => item.id === id)).toBe(false)

    await page.getByRole('button', { name: 'Eliminar Publicación actualizada de alcance cuatro', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar servicio', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toBeHidden()
    await expect(page.getByRole('button', { name: /^Todas/ })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Publicación actualizada de alcance cuatro', exact: true })).toHaveCount(0)
    const removed = await (await client.get('/api/search', { params: { q: 'alcance cuatro' } })).json()
    expect(removed.total).toBe(0)
    const stored = JSON.parse(await readFile(process.env.HOGAR_DB_PATH, 'utf8'))
    expect(stored.services.some((item) => item.id === id)).toBe(false)
  } finally { await client.dispose() }
})

test('RF-09 y RF-10: valida campos y propietario; conserva solicitudes al editar y eliminar', async ({ playwright, baseURL, databaseSnapshot }) => {
  const provider = await account(playwright, baseURL, 'Proveedor')
  const client = await account(playwright, baseURL, 'Cliente')
  const valid = { title: 'Servicio actualizado', description: 'Descripción actualizada', category: 'Plomería' }
  try {
    for (const data of [
      { ...valid, title: '   ' }, { ...valid, description: '' },
      { ...valid, category: 'Categoría inexistente' },
      { ...valid, category: 'Reparaciones e instalaciones' },
      { ...valid, title: 'a'.repeat(81) }, { ...valid, description: 'a'.repeat(801) },
    ]) {
      expect((await provider.post('/api/services', { data })).status()).toBe(400)
      expect((await provider.put('/api/services/demo-1', { data })).status()).toBe(400)
    }
    expect((await client.post('/api/services', { data: valid })).status()).toBe(403)
    expect((await client.put('/api/services/demo-1', { data: valid })).status()).toBe(403)
    expect((await client.delete('/api/services/demo-1')).status()).toBe(403)
    expect((await provider.put('/api/services/demo-4', { data: valid })).status()).toBe(404)
    expect((await provider.delete('/api/services/demo-4')).status()).toBe(404)
    const before = await (await client.get('/api/client/requests')).json()
    const providerBefore = await (await provider.get('/api/provider/requests')).json()
    expect(before.requests.some((item) => item.serviceTitle === 'Reparación e instalación de tuberías')).toBe(true)
    expect((await provider.put('/api/services/demo-1', { data: valid })).ok()).toBeTruthy()
    expect(await (await client.get('/api/client/requests')).json()).toEqual(before)
    expect((await provider.delete('/api/services/demo-1')).status()).toBe(200)
    expect(await (await client.get('/api/client/requests')).json()).toEqual(before)
    expect(await (await provider.get('/api/provider/requests')).json()).toEqual(providerBefore)
    const catalog = await (await client.get('/api/search')).json()
    expect(catalog.results.some((item) => item.id === 'demo-1')).toBe(false)
    const stored = JSON.parse(await readFile(process.env.HOGAR_DB_PATH, 'utf8'))
    expect(stored.requests).toEqual(JSON.parse(databaseSnapshot).requests)
  } finally { await provider.dispose(); await client.dispose() }
})

test('RF-11 y RF-12: navegar áreas y categorías, combinar zona y limpiar filtros', async ({ page }) => {
  await login(page, 'Cliente')
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await expect(page.getByText('9 servicios encontrados', { exact: true })).toBeVisible()
  const area = page.getByRole('combobox', { name: 'Filtrar por área de servicio', exact: true })
  await area.click()
  await page.getByRole('option', { name: 'Reparaciones e instalaciones', exact: true }).click()
  await expect(page.getByText('5 servicios encontrados', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Limpieza', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Carpintería', exact: true }).click()
  await expect(page.getByText('2 servicios encontrados', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Ruta de categorías' })).toContainText('Carpintería')
  const zone = page.getByRole('combobox', { name: 'Filtrar por zona de atención', exact: true })
  await zone.click()
  await page.getByRole('option', { name: 'Quesada', exact: true }).click()
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible()
  await zone.click()
  await page.getByRole('option', { name: 'Florencia', exact: true }).click()
  await expect(page.getByText('2 servicios encontrados', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('CLOSETS')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Instalación de puertas y closets'])
  await page.getByRole('searchbox').fill('sincoincidencias')
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click()
  await expect(page.getByText('9 servicios encontrados', { exact: true })).toBeVisible()
  await expect(area).toContainText('Todas las áreas')
  await expect(zone).toContainText('Todas las zonas')

  await page.setViewportSize({ width: 390, height: 844 })
  await area.click()
  await page.getByRole('option', { name: 'Limpieza y exteriores', exact: true }).click()
  await expect(page.getByText('3 servicios encontrados', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Jardinería', exact: true }).click()
  await expect(page.getByText('1 servicio encontrado', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('navigation', { name: 'Ruta de categorías' }).getByRole('button', { name: 'Limpieza y exteriores', exact: true }).click()
  await expect(page.getByText('3 servicios encontrados', { exact: true })).toBeVisible()
  await area.click()
  await page.getByRole('option', { name: 'Reparaciones e instalaciones', exact: true }).click()
  await expect(page.getByText('5 servicios encontrados', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('RF-13: busca sin distinguir tildes o mayúsculas y prioriza coincidencias en el título', async ({ page, playwright, baseURL }) => {
  const provider = await account(playwright, baseURL, 'Proveedor')
  try {
    for (const data of [
      { title: 'Calibración doméstica', description: 'Ajustes del sistema del hogar.', category: 'Plomería' },
      { title: 'Revisión doméstica', description: 'Incluye calibración del sistema.', category: 'Plomería' },
      { title: 'Revisión sin coincidencias', description: 'Mantenimiento preventivo.', category: 'Plomería' },
    ]) expect((await provider.post('/api/services', { data })).status()).toBe(201)
    await login(page, 'Cliente')
    await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
    await page.getByRole('searchbox').fill('  CALIBRACION  ')
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Calibración doméstica', 'Revisión doméstica'])
    await expect(page.getByText('Ordenados por relevancia', { exact: false })).toBeVisible()
    await page.getByRole('searchbox').fill('calibracion ajustes')
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Calibración doméstica'])
  } finally { await provider.dispose() }
})
